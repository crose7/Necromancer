// ArchiveManager=require(`./ArchiveManager`).ArchiveManager
// x=new ArchiveManager(`anitay/posts.gz`)
// authors={}
// x.each(post=>{
//     if ( authors[post.authorId] ){ authors[post.authorId]+=1 }
//     else{ authors[post.authorId]=1 }
// })
//
// y=JSON.parse(zlib.gunzipSync(fs.readFileSync(`anitay/authors.gz`)))
// Object.entries(authors).map(x=>[y.filter(a=>a.id==x[0])[0].displayName, x[1] ]).sort((a,b)=>b[1]-a[1])



const fs                =   require(`fs`)
const zlib              =   require(`zlib`)

var ArchiveManager    =   class{
    // constructor( archiveName, cb ){
    constructor(archiveURL,cb){
        this.url                =   archiveURL
        this.onFinish           =   cb
        this.c                  =   {n:0,inc(){this.n++}}
    }
    each( cb ){
        let self=this
        let archiveURL          =   this.url
        let key                 =   Buffer.from([ 31, 139, 8, 0, 0, 0, 0, 0, 0 ])
        // readStream         =   fs.createReadStream( `./${archiveName}/posts.gz` )

        let readStream          =   fs.createReadStream( archiveURL )


        // EXTRACTED buffers
        // this.result             =   []

        // 'SHORT TERM' buffer MEMORY
        let bufferStore        =   new Buffer(0)


        // console.time(`ArchiveManager ${this.url}`)
        // ON FINISH, ADD REMAINING buffer IN STORE
        readStream.on(`end`,_=>{
            if ( !readStream.bytesRead ){ return }
            // zlib.gunzip( bufferStore, ( err, item ) => cb( JSON.parse( item ) ) )
            let item        =   zlib.gunzipSync(bufferStore)
            cb( JSON.parse( item ) )
            // console.timeEnd(`ArchiveManager ${this.url}`)
            // console.log(`END`,this.c)
            this.onFinish(this)
        })

        readStream.on(`data`,chunk=>{
            // ADD TO bufferStore UNTIL WE GET MORE THAN ONE index...
            bufferStore     =   Buffer.concat([bufferStore,chunk])
            let indexes     =   bufferStore.reduce( (acc,x,i,a) => {
                if(x!=key[0]){return acc}
                return key.every((y,j)=>a[i+j]==y)?acc.concat([i]):acc
            },[])

            // LAST ISOLATED INDEX-RANGE MAY BE INCOMPLETE!
            // ISOLATED INDEXES MOVED FROM SHORT TO LONG TERM MEMORY
            if ( indexes.length > 1 ){
                let r           =   indexes.map( ( index, i, a ) => bufferStore.slice( index, a[i+1] ) )// OVERFLOWS GRACFULLY
                // r.slice( 0, r.length-1 ).forEach( bin => zlib.gunzip( bin, (err,item) => {cb(JSON.parse(item));self.c.inc()}))
                r.slice( 0, r.length-1 ).forEach( bin =>{
                    let item    =   zlib.gunzipSync(bin)
                    cb(JSON.parse(item));
                })

                bufferStore      =   bufferStore.slice( indexes[indexes.length-1], bufferStore.length )
            }
        })
    }
}
// new ArchiveManager(`./tay/posts.gz`).run( item => console.log( item.headline ) )

module.exports={
    ArchiveManager:ArchiveManager
}

// UZTX-386V6S
