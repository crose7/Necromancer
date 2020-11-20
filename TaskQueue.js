let fetch   =   require(`node-fetch`)
let fs      =   require(`fs`)
let bson    =   require(`bson`)
let zlib    =   require(`zlib`)

class TaskQueue{
    constructor( size = 5 , endFunc = _=>_ ){
        this.queueItems             =   []
        this.maxDownloading         =   size
        this.cb                     =   endFunc
    }

    // DownloadQueue RUNS (maxDownloading) activeItems,
    // FUNCTION ITSELF RUNS IN STEP,
    // BUT RUN CONCURRENTLY TOGETHER
    async activeItem(){
// console.log(`TaskQueue activeItem()`)


//         for( let i=0; i<this.queueItems.length; i++){
//             let queueItem           =   this.queueItems[i]
// if(!queueItem){console.warn(`TaskQueue activeItem() NO QUEUE ITEM?`,queueItem)}
//             if( !queueItem.active ){
//                 await queueItem._run()
//             }
//         }

        let continuing              =   true
        while ( this.queueItems.filter(x=>!x.active).length ){
            let inactiveItems           =   this.queueItems.filter(x=> !x.active)
// console.log(`TaskQueue activeItem() inactiveItems`,inactiveItems.length)
            if(inactiveItems[0]){
                await inactiveItems[0]._run()
            }else{}
        }
        // console.log(`TaskQueue activeItem() FINISH`)
    }


    addItem(item){
        this.queueItems.push(item)
    }

    addItems(items){
        items.forEach(item=>{
            this.addItem(item)
        })
    }

    async start(){
console.log(`TaskQueue start()`)
        let promises                =   new Array(this.maxDownloading).fill().map(_=>this.activeItem())
        return Promise.all(promises)
            .then(_=>{
                this.cb?this.cb(this):0
            }).catch(err=>console.error(`Promise.all`,err))
console.log(`TaskQueue start() END?`)
    }

}




class TaskItem{

    constructor(cb){
        this.active         =   false
        this.cb             =   cb
    }

    async _run(cb){
        this.active=true
        if(this.cb){
            // await this.cb().catch(err=>{console.log(`SHOULD CONTINUE`);continue})
            let retry=true
            while(retry){
                let cont=false
                await this.cb().catch(err=>{
                    console.error(`TaskItem _run() ERROR`,err);
                    // console.log(`TaskQueue _run() SHOULD CONTINUE`);cont=true
                })
                // if(cont){continue}
                retry=false
            }
        }
    }
}




module.exports={
    TaskQueue:TaskQueue,
    TaskItem:TaskItem
}
