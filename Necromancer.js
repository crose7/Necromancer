let fetch                   =   require(`node-fetch`)
let fs                      =   require(`fs`)
let bson                    =   require(`bson`)
let zlib                    =   require(`zlib`)
let xml2js                  =   require(`xml2js`)
const {promisify}           =   require(`util`)
//let writeFilePromise        =   promisify(fs.writeFile)//LATE GAME ADDITION

let TaskQueue               =   require(`./TaskQueue.js`).TaskQueue
let TaskItem                =   require(`./TaskQueue.js`).TaskItem
// let ArticleList             =   require(`./ArticleList.js`).ArticleList
let ArchiveManager          =   require(`./ArchiveManager.js`).ArchiveManager

let Necromancer             =   class{
    constructor(args){
        console.log(`Necromancer()`, args, process.argv)
        this.name           =   args?   args.name : process.argv[2]

        if( !this.name ){ throw(`Necromancer() YOU MUST PROVIDE AN ARCHIVE NAME!`) }
        if( !fs.existsSync(`${this.name}`) ){ fs.mkdirSync(this.name) }
        if( !fs.existsSync(`${this.name}/data`) ){ fs.mkdirSync(`${this.name}/data`) }
        // DEFAULT VALUES GO HERE
        this.queryURL

        this.selectedEndpoint
        let searchEndpoint      =   `https://gizmodo.com/api/core/post/search?&userHash=804c199ec15a1890b690ed28f98d36f67d97883d&maxReturned=100`
        let postsEndpoint       =   `https://kinja.com/api/magma/post/views/id/?`
        let flatrepliesEndpoint =   `https://kinja.com/ajax/comments/views/flatReplies` // /${id}?startIndex=${startIndex}&maxReturned=100&approvedOnly=false&cache=true&sorting=oldest`

        this.indexFinished
        this.resumeURL

        this.errors         =   []

        let _query          =   this.parseFlag(`query`,args)
        let _fastDownload   =   process.argv.some(x=>x===`--fastDownload`)  ||  (args?args.fastDownload:0)
        let _download       =   process.argv.some(x=>x===`--download`)      ||  (args?args.download:0)
        let _logBlogs       =   process.argv.some(x=>x===`--logBlogs`)      ||  (args?args.logBlogs:0)
        let _rssExport      =   process.argv.some(x=>x===`--rssExport`)     ||  (args?args.rssExport:0)

        let f
        if( fs.existsSync(`${this.name}/progressInfo`) ){ f = JSON.parse( fs.readFileSync(`${this.name}/progressInfo`) ) }
        // console.log(this)
        for( let key in f ){
            this[key]       =   f[key]
        }
        console.log(this)

        if( _logBlogs ){ this.logBlogs(); return; }

        if( _query ){
            this.selectedEndpoint   =   searchEndpoint
            this.query              =   _query
            this.queryURL           =   this.queryURL?this.queryURL:this.selectedEndpoint+`&query=${encodeURIComponent(this.query)}&startIndex=0`
            // this.resumeURL          =   this.queryURL
            return this.fetchIDs()
        }

        if ( _rssExport ){
            let index               =   process.argv.findIndex(x=>x==`--rssExport`)
            this.selectedEndpoint   =   process.argv[index+1]
            this.queryURL           =   this.queryURL?this.queryURL:this.selectedEndpoint+`&startTime=${new Date().getTime()}`
            console.log(`RSS EXPORT`,this.queryURL)
            return this.rssExport()
        }

        if( _download ){
            this.selectedEndpoint   =   flatrepliesEndpoint
            console.log(`DOWNLOAD`,this.selectedEndpoint,this.queryURL)
            return this.download()
        }

        if( _fastDownload ){
            this.selectedEndpoint   =   postsEndpoint
            return this.fastDownload()
        }

    }





    parseFlag(flag,args){
        let r
        if( args?args[flag]:0 ){ r = args[flag] }
        if( process.argv.some(x=>x===`--${flag}`) ){
            let index       =   process.argv.findIndex(x=>x===`--${flag}`)
            r               =   process.argv[index+1]

        }
        return r
    }




    async rssExport(){
        if( this.indexFinished ){ console.log(`INDEX FINISHED`); return; }

        let ids             =   []
        if( fs.existsSync(`${this.name}/ids`) ){ ids = JSON.parse(fs.readFileSync(`${this.name}/ids`)) }

        // let dataOutput      =   fs.createWriteStream(`${this.name}/data/rssData`, { flags:`a` })
        // let idOutput        =   fs.createWriteStream(`${this.name}/ids`, { flags:`a` })
        let queryURL        =   this.queryURL
        let startTime

        console.log(`Necromancer rssExport()`,queryURL)

        let cond            =   true
        while(cond){

            let r           =   await fetch( queryURL ).catch( err => { throw(`Necromancer rssExport() fetch`, err ) })
                r           =   await r.text().catch( err => { this.errors.push(err); throw(`Necromancer rssExport() text`) })
                r           =   await xml2js.parseStringPromise( r, {strict:true} ).catch( err => { this.errors.push(err); throw(`Necromancer rssExport() xml2js`) })

            r.feed.entry.map(x=>JSON.stringify(x))
                        .map(x=>zlib.gzipSync(x))
                        // .forEach(x=>dataOutput.write(x))
console.log(r.feed.entry)
            r.feed.entry.map(x=>x.id).forEach(_id=>{
                if(!ids.some(x=>x.id===_id)){
                    let id      =   _id[0].match(/\d*$/)[0]
                    ids.push({
                        id:             id,
                        fastDownload:   false,
                        download:       false,
                    })
                }
            })
console.log(r.feed.link)
            if( r.feed.link.some(link=>link.$.rel===`next`) ){
                let next            =   r.feed.link.filter( link => link.$.rel === `next` )[0]
                startTime           =   next.$.href.split(`&`)[1]
                startTime           =   startTime.split(`=`)[1]
                this.queryURL       =   this.selectedEndpoint+`&startTime${startTime}`
            }else{
                cond                =   false
            }
        }
        this.indexFinished         =   true
        console.log(`Necromancer fetchIDs() ${ids.length} ids tallied`)
        // dataOutput.end()
        fs.writeFileSync(`${this.name}/ids`,JSON.stringify(ids))
        fs.writeFileSync(`${this.name}/progressInfo`,JSON.stringify(this))

        if(this.errors.length){this.errors.forEach(err=>console.log(err))}
    }




    async download(){

        let articleOutput   =   fs.createWriteStream(`${this.name}/data/articles`, {flags:`a`})
        let commentOutput   =   fs.createWriteStream(`${this.name}/data/comments`, {flags:`a`})

        let ids
        let undownloadedIDs
        let undownloadedComments

        let queue           =   new TaskQueue(10,()=>{})

        if( fs.existsSync(`${this.name}/ids`) ){
            ids             =   JSON.parse(fs.readFileSync(`${this.name}/ids`))
            undownloadedIDs =   ids.filter(x=>!x.download).map(x=>x.id)
        }else{ throw(`Necromancer fastDownload() NO IDS FOUND! Did you start with --query?`) }

        for( let i=0; i<undownloadedIDs.length; i++){
            let id          =   undownloadedIDs[i]
            queue.addItem( new TaskItem(async ()=>{
                let cond        =   true
                let startIndex  =   0
                // let loopCount=0
                let article
                let comments    =   []
                while( cond ){
// console.log(this.selectedEndpoint+`/${id}?startIndex=${startIndex}&maxReturned=100&approvedOnly=false&cache=true&sorting=oldest`)
console.log(`DOWNLOAD`,id,this.selectedEndpoint+`/${id}?startIndex=${startIndex}&maxReturned=100&approvedOnly=false&cache=true&sorting=oldest`)
                    let r       =   await fetch(this.selectedEndpoint+`/${id}?startIndex=${startIndex}&maxReturned=100&approvedOnly=false&cache=true&sorting=oldest`).catch(err=>{ this.errors.push(err); throw(`Necromancer download() TaskItem fetch`) })
                        r       =   await r.json().catch(err=>{ this.errors.push(err); throw(`Necromancer download() TaskItem json`) })

                        article             =   r.data.items[0].reply
                    let _comments           =   r.data.items[0].children
                        _comments.items.forEach(comment=>comments.push(comment))
                    // console.log(`_comments`,comments.length)

                    let pagination          =   _comments.pagination
                        cond                =   !!pagination.next
                        startIndex          +=  100
                    let index               =   ids.findIndex(x=>x.id==article.id)
// console.log(pagination.curr.total,comments.length,article.headline)
                        ids[index].download =   true
                }
            console.log(`Necromancer download() while\tprogress: ${ids.filter(x=>x.download).length}/${ids.length}\tcomments: ${comments.length}\tid: ${article.id}\tarticle: ${article.headline}`)
                articleOutput.write( zlib.gzipSync(JSON.stringify(article)) )
                commentOutput.write( zlib.gzipSync(JSON.stringify(comments)) )
            }))
        }

        console.log(`Necromancer download() queue START`)
        await queue.start()
        fs.writeFileSync(`${this.name}/progressInfo`,JSON.stringify(this))
        fs.writeFileSync(`${this.name}/ids`,JSON.stringify(ids))
        if(this.errors.length){this.errors.forEach(err=>console.log(err))}
        console.log(`Necromancer download() queue END`)

    }




    async fastDownload(){

        let postOutput      =   fs.createWriteStream(`${this.name}/data/posts`, {flags:`a`})
        // let authorOuput     =   fs.createWriteStream(`${this.name}/data/authors`, {flags:`a`})
        // let blogOuput       =   fs.createWriteStream(`${this.name}/data/blogs`, {flags:`a`})

        let ids
        let undownloadedIDs
        let authors         =   []
        let authorIDSet     =   new Set()
        let blogs           =   []
        let blogIDSet       =   new Set()

        if( fs.existsSync(`${this.name}/ids`) ){
            ids             =   JSON.parse(fs.readFileSync(`${this.name}/ids`))
            undownloadedIDs =   ids.filter(x=>!x.fastDownload).map(x=>x.id)
        }else{ throw(`Necromancer fastDownload() NO IDS FOUND! Did you start with --query?`) }

        if( fs.existsSync(`${this.name}/authors`) ){
            authors         =   JSON.parse( zlib.gunzipSync(fs.readFileSync(`${this.name}/data/authors`)) )
            authorIDSet     =   authors.reduce((acc,author)=>acc.add(author.id),new Set())
            // console.log(`authorIDSet`,authorIDSet)
        }

        if( fs.existsSync(`${this.name}/blogs`) ){
            blogs           =   JSON.parse( zlib.gunzipSync(fs.readFileSync(`${this.name}/data/blogs`)) )
            blogIDSet       =   blogs.reduce((acc,blog)=>acc.add(blog.id),new Set())
            // console.log(`blogIDSet`,blogIDSet)
        }



        let queue                   =   new TaskQueue(10,()=>{})

        let downloadedPostCount     =    0
        let halt=false
        while(undownloadedIDs.length){
            console.log(`UNDOWNLOADED IDS`,undownloadedIDs.length)

            let s           =   undownloadedIDs.splice(0,100)
                s           =   s.reduce((acc,id)=>acc+=`&postId=`+id,``)
            let queryURL    =   this.selectedEndpoint+s

            queue.addItem( new TaskItem(async ()=>{
                // if( (Math.random() < 0.5) && !halt){
                //     throw(`THROW`)
                // }
                let r       =   await fetch(queryURL).catch(err=>{ this.errors.push(err); throw(`Necromancer fastDownload() TaskItem fetch`) })

                    r       =   await r.json().catch(err=>{ this.errors.push(err); throw(`Necromancer fastDownload() TaskItem json`) })



                r.data.posts.forEach(post=>{
                    postOutput.write( zlib.gzipSync(JSON.stringify(post)) )
                    let index           =   ids.findIndex(x=>x.id==post.id)
                    ids[index].fastDownload=true
                })
                // console.log(authors)
                Object.entries(r.data.authors).forEach(x=>x[1].forEach(author=>{
                    // console.log(author.id,authorIDSet.has(author.id))
                    if( !authorIDSet.has( author.id ) ){
                        console.log(`NEW author`,author.id)
                        authorIDSet.add(author.id)
                        authors.push(author)
                    }
                }))

                Object.entries(r.data.blogs).forEach(x=>x[1].forEach(blog=>{
                    if( !blogIDSet.has( blog.id ) ){
                        console.log(`NEW BLOG`,blog.id)
                        blogIDSet.add(blog.id)
                        blogs.push(blog)
                    }
                }))
                // this.resumeURL          =   queryURL
                console.log(`Necromancer fastDownload() while ${ids.filter(x=>x.fastDownload).length}/${ids.length}`)

            }))
        }
        console.log(`Necromancer fastDownload() queue START`)
        await queue.start()
        if(this.errors.length){this.errors.forEach(err=>console.log(err))}
        console.log(`Necromancer fastDownload() queue END ${ids.filter(x=>x.fastDownload).length}/${ids.length}`)
        fs.writeFileSync(`${this.name}/progressInfo`,   JSON.stringify(this))
        fs.writeFileSync(`${this.name}/ids`,            JSON.stringify(ids))
        fs.writeFileSync(`${this.name}/data/authors`,        zlib.gzipSync(JSON.stringify(authors)) )
        fs.writeFileSync(`${this.name}/data/blogs`,          zlib.gzipSync(JSON.stringify(blogs)) )
    }





    async fetchIDs(){
        if( this.indexFinished ){ console.log(`INDEX FINISHED`); return; }

        // let ids             =   {}
        let ids             =   []
        if( fs.existsSync(`${this.name}/ids`) ){ ids = JSON.parse(fs.readFileSync(`${this.name}/ids`)) }

        let dataOutput      =   fs.createWriteStream(`${this.name}/data/initialData`, { flags:`a` })
        // let idOutput        =   fs.createWriteStream(`${this.name}/ids`, { flags:`a` })
        let queryURL        =   this.queryURL
        let query           =   this.query
        let startIndex      =   0
        let cond            =   true
        while(cond){
            // if(Math.random() < 0.2){
            //     fs.writeFileSync(`${this.name}/progressInfo`,JSON.stringify(this))
            //     fs.writeFileSync(`${this.name}/ids`,JSON.stringify(ids))
            //     throw(`THROW`)
            // }
            // console.log(`Necromancer fetchIDs() while ${queryURL}`)
            let r           =   await fetch(queryURL).catch( err => {
                                    // fs.writeFileSync(`${this.name}/progressInfo`,JSON.stringify(this))
                                    // fs.writeFileSync(`${this.name}/ids`,JSON.stringify(ids))
                                    this.errors.push(err)
                                    throw(`Necromancer fetchIDs() while fetch`,err )
                                })
                r           =   await r.json().catch( err => {
                                    // fs.writeFileSync(`${this.name}/progressInfo`,JSON.stringify(this))
                                    // fs.writeFileSync(`${this.name}/ids`,JSON.stringify(ids))
                                    this.errors.push(err)
                                    throw(`Necromancer fetchIDs() while json`, err)
                                })
            console.log(`Necromancer fetchIDs() while ${queryURL} ${r.data.pagination.curr.startIndex}/${r.data.pagination.total}`)

            let next            =   r.data.pagination.next
            if( next ){
                startIndex      =   r.data.pagination.next.startIndex
                queryURL        =   this.selectedEndpoint+`&query=${query}&startIndex=${startIndex}`
                this.queryURL   =   queryURL
                fs.writeFileSync(`${this.name}/progressInfo`,JSON.stringify(this))
            }else{
                cond            =   false
            }
            r.data.items.map(x=>JSON.stringify(x)).map(x=>zlib.gzipSync(x)).forEach(x=>dataOutput.write(x))
            r.data.items.map(x=>x.id).forEach(id=>{
                if(!ids.some(x=>x.id===id)){
                    ids.push({
                        id:             id,
                        fastDownload:   false,
                        download:       false,
                    })
                }
            })
        }
        this.indexFinished         =   true
        if(this.errors.length){this.errors.forEach(err=>console.log(err))}
        console.log(`Necromancer fetchIDs() ${ids.length} ids tallied`)
        dataOutput.end()
        fs.writeFileSync(`${this.name}/ids`,JSON.stringify(ids))
        fs.writeFileSync(`${this.name}/progressInfo`,JSON.stringify(this))
    }




    logBlogs(){
        let blogs           =   JSON.parse(zlib.gunzipSync(fs.readFileSync(`${this.name}/data/blogs`)))
        blogs.forEach(blog=>console.log(`id: ${blog.id}\tname: ${blog.name}\tdisplayName: ${blog.displayName}`))
    }
}

module.exports={
    Necromancer:Necromancer
}
process.argv.length>1?new Necromancer():0
