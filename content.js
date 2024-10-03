console.log("n0code tweaks loaded");
let root = document.body.parentElement;

let isCoursesPage = (location.pathname == "/work/teaching/courses/index.html");
if(isCoursesPage){
    document.body.style.overflow = "hidden";
}

function clearStorage(){
    root.className = "";
    localStorage.removeItem("__customCSS");
    localStorage.removeItem("__customPack");
    localStorage.removeItem("activePack");
}

/**@type {HTMLElement[]}*/
let allCustomElms = [];

// database

let dbLoadedRes;
let dbLoadedProm = new Promise(resolve=>dbLoadedRes = resolve);

let dbReq = indexedDB.open("main",3);
/**@type {IDBDatabase}*/
let db;
/**@type {IDBObjectStore}*/
let recentsStore;
dbReq.addEventListener("upgradeneeded",e=>{
    /**@type {IDBOpenDBRequest}*/
    let req = e.target;

    let db = req.result;

    console.log("upgrading db");

    if(!db.objectStoreNames.contains("recents")) db.createObjectStore("recents");

    let store = req.transaction.objectStore("recents");
    if(!store.indexNames.contains("handle")) store.createIndex("handle","handle",{unique:true});
});
dbReq.addEventListener("success",e=>{
    dbLoadedRes();

    console.log("successfully opened recent files db");
    db = dbReq.result;

    recentsStore = db.transaction("recents","readwrite").objectStore("recents");

    recentsStore.count().onsuccess = (e)=>{
        console.log("AMT: ",e.target.result);
    };
    // store.put()
});
dbReq.addEventListener("error",e=>{
    console.warn("ERROR opening db",e);
});
dbReq.addEventListener("blocked",e=>{
    console.warn("ERROR db blocked",e);
});

/**@returns {Promise<any[]>}*/
async function getRecentFiles(){
    await dbLoadedProm;

    let list = [];

    let t = db.transaction(["recents"],"readonly");
    let store = t.objectStore("recents");

    return new Promise(resolve=>{
        let cur = store.openCursor();
        let i = 0;
        cur.onsuccess = function(e){
            let cursor = (e.target).result;
            if(!cursor){
                list.reverse();
                resolve(list);
                return;
            }

            list.push(cursor.value);

            i++;
            cursor.continue();
        };
        cur.onerror = function(e){
            console.warn("Failed to open cursor");
            resolve(null);
        };
    })
}
/**@returns {Promise<boolean>}*/
async function addToRecentFiles(/**@type {FileSystemFileHandle}*/ handle){
    if(!handle){
        console.warn("Canceled add, handle was null");
        return false;
    }

    let start = performance.now();
    let files = await getRecentFiles();
    let alreadyThere = false;
    let existingDate = null;
    for(const v of files){
        if(await handle.isSameEntry(v.handle)){
            alreadyThere = true
            existingDate = v.date;
            break;
        }
    }
    // if(alreadyThere){
    //     // console.warn("canceled, already in the recent files list");
    //     return false;
    // }

    let t = db.transaction(["recents"],"readwrite");
    let store = t.objectStore("recents");

    return new Promise(resolve=>{
        let date = new Date().toISOString();
        let id = date;
        let v = {
            date,
            handle
        };
        if(existingDate) store.delete(existingDate);
        let req = store.put(v,id);
        req.onsuccess = function(e){
            console.log("TAX time: ",performance.now()-start);
            resolve(true);
        };
        req.onerror = function(e){
            resolve(false);
        };
    })
}

async function removeFromRecentFiles(/**@type {FileSystemFileHandle}*/ handle){
    if(!handle){
        console.warn("Canceled add, handle was null");
        return false;
    }

    let list = await getRecentFiles();
    /**@type {FileSystemFileHandle}*/
    let v;
    for(const v1 of list){
        if(await handle.isSameEntry(v1.handle)) v = v1;
    }
    if(!v){
        alert("Failed to remove from recents, it wasn't in the recents list");
        console.warn("Failed to remove from recents, it wasn't in the recents list",list,handle);
        return false;
    }

    let t = db.transaction(["recents"],"readwrite");
    let store = t.objectStore("recents");

    return new Promise(resolve=>{
        let req = store.delete(v.date);
        req.onsuccess = function(e){
            resolve(true);
        };
        req.onerror = function(e){
            resolve(false);
        };
    });
}

/**@returns {Promise<boolean>}*/
async function clearRecentFiles(){
    let t = db.transaction(["recents"],"readwrite");
    let store = t.objectStore("recents");

    let req = store.clear();
    return new Promise(resolve=>{
        req.onsuccess = function(e){
            resolve(true);
        };
        req.onerror = function(e){
            resolve(false);
        };
    });
}

//

class RegImg{
    static async create(/**@type {File}*/f){
        let t = new RegImg();
        t.name = f.name;
        t.f = f;

        t.url = URL.createObjectURL(t.f);

        t.buf = new Uint8Array(await f.arrayBuffer());

        return t;
    }
    /**@type {File} */
    f;
    name = "";
    url;
    /**@type {Uint8Array} */
    buf;
    
    getID(){
        let name = this.name.replace(/\./g,"_");
        return "--img-"+name;
    }
    register(){
        let id = this.getID();
        console.log("> registered img with id: ",id);
        root.style.setProperty(id,`url(${this.url})`);
    }

    serialize(){
        return {
            name:this.name,
            buf:Array.from(this.buf)
        };
    }
    static deserialize(data){
        let t = new RegImg();
        t.buf = new Uint8Array(data.buf);
        t.name = data.name;
        t.f = new File([t.buf],t.name);
        t.url = URL.createObjectURL(t.f);
        return t;
    }
}
class RegCSS{
    static async create(/**@type {File}*/f){
        let t = new RegCSS();

        t.name = f.name;
        t.content = await f.text();
        
        return t;
    }
    name = "";
    content = "";
    
    serialize(){
        return {
            name:this.name,
            content:this.content
        };
    }
    static deserialize(data){
        let t = new RegCSS();
        t.name = data.name;
        t.content = data.content;
        return t;
    }

    register(){
        addCustomCSS(this.content);
    }
}

/**@type {CustomPack} */
let curPack = null;
class CustomPack{
    constructor(/**@type {FileSystemDirectoryHandle}*/h){
        this.h = h;
    }
    /**@type {FileSystemDirectoryHandle} */
    h;
    config;

    async postLoad(){
        if(this.disabled) return;

        readCSSCmds();
        console.log("RUN POST",{hasHandle:this.h != null});
        run();
    }

    async parseConfig(){
        if(this.h){
            /**@type {FileSystemFileHandle}*/
            let conf;
            try{
                conf = await this.h.getFileHandle("config.json");
            }
            catch (e) {
                // no config file found
            }

            if(conf){
                let text = await (await conf.getFile()).text();
                this.config = JSON.parse(text);
                console.log("LOADED CONFIG: ",this.config);
                this.loadConfig();
            }
        }
    }
    loadConfig(){
        let c = this.config;
        if(!c) return;

        let style = c.style;
        if(style?.auto_invert){
            root.classList.add("auto-invert");
        }
        /* DEPRECATED for now */
        // if(!style?.any_page){
        //     if(location.pathname != "/work/teaching/courses/index.html"){
        //         this.disable();
        //     }
        // }
    }

    disabled = false;
    disable(){
        clearCSS();
        for(const c of allCustomElms){
            removeCustomElm(c);
        }
    }

    async reload(force=false){
        if(this.disabled) return;

        let handle = this.h;
        if(force) handle = null;
        if(!handle){
            try{
                handle = await showDirectoryPicker({
                    id:"custom_folder",
                    mode:"read"
                });
            }
            catch(e){
                return;
            }
        }
        if(!handle) return;

        let res = await handle.requestPermission();
        if(res == "denied") return;

        this.h = handle;
        let recentRes = await addToRecentFiles(handle);
        if(recentRes) console.log("Saved handle to recents successfully");

        clearStorage();
        clearCSS();

        localStorage.setItem("activePack",handle.name);

        let reg = new CustomPack(handle);
        
        async function search(/**@type {FileSystemDirectoryHandle}*/handle){
            for await(const [name,h] of handle.entries()){
                console.log("n: ",name,h.kind);
                let ext = name.split(".").pop();
                if(h.kind == "file"){
                    let f = await h.getFile();
                    if(f.type.startsWith("image/")){
                        reg.images.push(await RegImg.create(f));
                    }
                    else if(ext == "css"){
                        let r = await RegCSS.create(f);
                        reg.css.push(r);
                    }
                }
                else await search(h);
            }
        }
        await search(handle);
        await reg.parseConfig();

        console.log("REG:",reg);

        reg.registerAll();
        reg.save();

        await reg.postLoad();
    }
    
    /**@type {RegImg[]} */
    images = [];

    /**@type {RegCSS[]} */
    css = [];

    save(){
        let o = {
            images:this.images.map(v=>v.serialize()),
            css:this.css.map(v=>v.serialize())
        };
        if(this.config) o.config = this.config;
        let s = JSON.stringify(o);
        console.log("-----save:",o,this.config);
        localStorage.setItem("__customPack",s);
    }
    static async load(pack){
        let list = await getRecentFiles();
        let activePack = localStorage.getItem("activePack");
        let h = undefined;
        if(list){
            let q = list.find(v=>v.handle.name == activePack);
            h = q?.handle;
        }

        //

        let p = new CustomPack(h);
        for(const a of pack.images){
            p.images.push(RegImg.deserialize(a));
        }
        for(const a of pack.css){
            p.css.push(RegCSS.deserialize(a));
        }
        if(pack.config) p.config = pack.config;

        console.log("-------loading: ",pack);

        p.registerAll();

        curPack = p;
        if(p.config) p.loadConfig();
        setTimeout(()=>{ p.postLoad(); },0);
        return p;
    }

    registerAll(){
        for(const a of this.css){
            a.register();
        }
        for(const img of this.images){
            img.register();
        }
    }
}

document.addEventListener("keydown",async e=>{
    let k = e.key.toLowerCase();

    if(e.altKey && !e.shiftKey && !e.ctrlKey){
        if(e.key == "c"){ // apply custom CSS
            e.preventDefault();
            cmds.customCSS.run();
        }
        else if(e.key == "r" || e.key == "d"){ // clear custom CSS
            e.preventDefault();
            cmds.reset.run();
        }
        else if(e.key == "f"){
            e.preventDefault();
            cmds.reloadPack.run();
        }
        else if(e.key == "g"){
            e.preventDefault();
            cmds.regenGlobalVars.run();
        }
        else if(e.key == "w"){
            e.preventDefault();
            showCmdPalette();
        }
    }
    if(e.ctrlKey && !e.shiftKey && !e.altKey){
        if(e.key == "o") {
            e.preventDefault();
            cmds.openPack.run();
        }
    }
    if(e.shiftKey && !e.ctrlKey && !e.altKey){
        if(k == "r"){
            e.preventDefault();
            cmds.reloadPack.run();
        }
        else if(k == "w"){
            e.preventDefault();
            showCmdPalette();
        }
        else if(k == "g"){
            e.preventDefault();
            cmds.regenGlobalVars.run();
        }
    }
    if((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() == "p"){
        e.preventDefault();
        showCmdPalette();
    }
});
document.addEventListener("mousedown",e=>{
    if(e.shiftKey && e.button == 0){
        e.preventDefault();
        showCmdPalette();
    }
});

class CmdItem{
    constructor(title) {
        this.title = title;
    }
    /**@type {string}*/
    title;
}
class CmdFolder extends CmdItem{
    constructor(title="",/**@type {()=>Promise<CmdItem[]>}*/ getCmds) {
        super(title);
        this.getCmds = getCmds;
    }
    /**@type {()=>Promise<CmdItem[]>}*/
    getCmds;
    onView;
}
class CmdAction extends CmdItem{
    /**@type {()=>void}*/
    run;
    /**@type {string}*/
    key;
}

function reloadPack(force=false){
    if(!curPack) new CustomPack(null).reload(true);
    else curPack.reload(force);
}

/**@type {Record<string,CmdItem>} */
let cmds = {
    recentPacks:{
        title:"Recent Packs",
        getCmds:async ()=>{
            let res = await getRecentFiles();
            return res.map(v=>{
                return {
                    title:v.handle.name,
                    handle:v.handle,
                    run:()=>{
                        curPack = new CustomPack(v.handle);
                        reloadPack();
                        localStorage.setItem("activePack",v.handle.name);
                    }
                };
            })
            // return [
            //     {
            //         title:"Pack 1",
            //         run:()=>{
            //             console.log("load: Pack 1");
            //         }
            //     },
            //     {
            //         title:"Pack 2",
            //         run:()=>{
            //             console.log("load: Pack 2");
            //         }
            //     }
            // ];
        },
        onView:async (i,v,name,d)=>{
            if(name == localStorage.getItem("activePack")){
                d.classList.add("activePack");
            }

            let removeBtn = document.createElement("button");
            removeBtn.classList.add("remove-btn");
            removeBtn.textContent = "X";
            d.appendChild(removeBtn);

            removeBtn.addEventListener("click",async e=>{
                e.stopImmediatePropagation();
                e.stopPropagation();

                let res = await removeFromRecentFiles(v.handle);
                if(res) d.remove();

                if(await curPack.h.isSameEntry(v.handle)){
                    cmds.reset.run();
                }
            });
        }
    },
    openPack:{
        title:"Open Pack",
        key:"Ctrl+O",
        run:()=>{
            reloadPack(true);
        }
    },
    reloadPack:{
        title:"Reload Pack",
        key:"Alt+F, Shift+R",
        run:()=>{
            reloadPack();
        }
    },
    regenGlobalVars:{
        title:"Regenerate Global Vars",
        key:"Alt+G, Shift+G",
        run:()=>{
            genGlobalVars();
        }
    },
    reset:{
        title:"Reset Tweaks",
        key:"Alt+R",
        run:()=>{
            clearStorage();
            clearCSS();
            curPack = null;
        }
    },
    customCSS:{
        title:"Apply Custom CSS File (Deprecated)",
        key:"Alt+C",
        run:async ()=>{
            let [file] = await showOpenFilePicker({
                id:"custom_css"
            });
            if(!file) return;

            let res = await file.requestPermission();
            if(res == "denied") return;

            let s = await (await file.getFile()).text();
            localStorage.setItem("__customCSS",s);
            loadCustomCSS(s);
        }
    }
};
let cmdsList = [
    cmds.openPack,
    cmds.recentPacks,
    {type:"hr"},
    cmds.reloadPack,
    cmds.regenGlobalVars,
    cmds.reset,
    cmds.customCSS,
];

function showCmdPalette(){
    let existing = document.querySelector(".__tweaks-cmd-palette");
    if(existing){
        existing.remove();
        return;
    }
    let cont = document.createElement("div");
    cont.className = "__tweaks-cmd-palette";

    // let ok = Object.keys(cmds);


    let heading = document.createElement("div");
    heading.innerHTML = `
        <div class="__tweaks-cmd-title">Command Palette</div>
    `;
    cont.appendChild(heading);
    let hr = document.createElement("hr");
    cont.appendChild(hr);

    function addItem(cmd,cont1){
        let d = document.createElement("div");
        d.className = "__tweaks-cmd";

        if("run" in cmd){
            d.innerHTML = `
                <div>${cmd.title}</div>
                ${cmd.key ? `<div class="__tweaks-cmd-keybind">${cmd.key}</div>` : ""}
            `;
            cont1.appendChild(d);

            d.addEventListener("click",e=>{
                cmd.run();
                cont.remove();
            });
        }
        else{
            d.classList.add("__tweaks-cmd-folder");
            d.innerHTML = `
                <div>${cmd.title}</div>
                <div>></div>
            `;
            cont1.appendChild(d);

            let newCont = document.createElement("div");
            newCont.className = "__tweaks-cmd-subfolder __tweaks-cmd-palette";
            newCont.style.display = "none";
            d.appendChild(newCont);
            d.addEventListener("mouseenter",async e=>{
                newCont.innerHTML = "";
                newCont.style.display = "block";

                let cmds = await cmd.getCmds();
                let i = 0;
                for(const c of cmds){
                    if(testType(c,newCont)) continue;
                    let dd = addItem(c,newCont);
                    if(cmd.onView) cmd.onView(i,c,cmd.title,dd);
                    i++;
                }
            });
            d.addEventListener("mouseleave",e=>{
                newCont.innerHTML = "";
                newCont.style.display = "none";
            });
        }

        return d;
    }

    function testType(cmd,cont){
        if("type" in cmd){
            let type = cmd.type;
            if(type == "hr"){
                let hr = document.createElement("hr");
                cont.appendChild(hr);
            }
            return true;
        }
        return false;
    }

    for(const cmd of cmdsList){
        if(testType(cmd,cont)) continue;
        addItem(cmd,cont);
    }

    // document.body.insertBefore(cont,document.body.children[0]);
    document.body.appendChild(cont);
}

function loadPack(){
    let pack = localStorage.getItem("__customPack");
    if(!pack){
        console.log("Failed to load custom pack, no pack was found.");
        return;
    }
    let o = JSON.parse(pack);

    let p = CustomPack.load(o);
    console.log("loaded: ",p);

    let activePack = localStorage.getItem("activePack");
    (async ()=>{
        await dbLoadedProm;
        getRecentFiles().then(list=>{
            let q = list.find(v=>v.handle.name == activePack);
            if(q){
                p.h = q.handle;
                console.log(">> Automatically found and associated handle");
            }
            else console.log(">> Failed to find handle associated with pack");
        });
    })();
}
loadPack();

function clearCSS(){
    let existing = document.querySelectorAll(".custom-style");
    for(const a of existing){
        a.remove();
    }
}
function loadCustomCSS(s=""){
    clearCSS();
    addCustomCSS(s);
}
function addCustomCSS(s=""){
    let customStyle = document.createElement("style");
    customStyle.rel = "stylesheet";
    customStyle.innerHTML = s;
    customStyle.className = "custom-style";
    document.head.appendChild(customStyle);
}
function init(){
    let s = localStorage.getItem("__customCSS");
    if(s) loadCustomCSS(s);
}
init();

class Obj{
    constructor(/**@type {HTMLElement}*/e){
        // this.ref = e.cloneNode(true);
        this.ref = e;
        let a = this.ref.querySelector("a");
        this.ref.style.margin = "0px";
        
        this.link = a ? a.href : "";
        this.text = a ? a.textContent : "";
        this.w = e.getBoundingClientRect().width/2;

        this.x = Math.random()*(innerWidth-150);
        this.y = Math.random()*(innerHeight-150);

        let lvx = 0;
        let lvy = 0;
        let lax = 0;
        let lay = 0;
        let over = false;
        let t = this;
        this.ref.addEventListener("mouseenter",function(e){
            if(!over){
                lvx = t.vx;
                lvy = t.vy;
                lax = t.ax;
                lay = t.ay;
            }
            over = true;
            t.vx = 0;
            t.vy = 0;
            t.ax = 0;
            t.ay = 0;
            t.update();
        });
        this.ref.addEventListener("mouseleave",function(e){
            over = false;
            t.vx = lvx;
            t.vy = lvy;
            t.ax = lax;
            t.ay = lay;
            t.update();
        });
    }
    link = "";
    text = "";
    /**@type {HTMLElement} */
    ref;

    w = 100;
    x = 0;
    y = 0;
    vx = 0;
    vy = 0;
    ax = 0;
    ay = 0;
    ldx = 0;
    ldy = 0;
    ldist = 1;

    lastCol = 0;

    update(){
        this.ref.style.left = `${this.x}px`;
        this.ref.style.top = `${this.y}px`;
    }
}

/**@type {Obj[]} */
let objs = [];

let aDrag = 0.9995;
let vDrag = 0.9995;
// let aDrag = 0.98;
// let vDrag = 0.98;
let colDrag = 0.8;
let maxVel = 1.5;

function run(){
    timeStart = performance.now();
    
    for(const o of objs){
        let lx = o.x;
        let ly = o.y;

        o.w = o.ref.getBoundingClientRect().width/2;

        let ang = Math.random()*6.28;
        let amt = 0.05;
        o.ax = Math.cos(ang)*amt;
        o.ay = Math.sin(ang)*amt;

        let dx = o.x-lx;
        let dy = o.y-ly;
        o.ldx = dx;
        o.ldy = dy;
        o.ldist = Math.sqrt(dx**2+dy**2);
        
        o.update();
    }
}

let timeStart = 0;

function update(){
    requestAnimationFrame(update);

    let t = performance.now();

    for(const a of objs){
        a.ref.style.backgroundColor = null;
        a.ref.style.transition = "none";

        a.ax *= aDrag;
        a.ay *= aDrag;
        a.vx *= vDrag;
        a.vy *= vDrag;

        a.vx += a.ax;
        a.vy += a.ay;

        // a.w = a.ref.getBoundingClientRect().width/2; // idk if this should run every frame

        let margin = a.w*2;
        if(a.x < 0){
            a.x = 0;
            a.vx = Math.abs(a.vx);
        }
        else if(a.x >= innerWidth-margin){
            a.x = innerWidth-margin-1;
            a.vx = -Math.abs(a.vx);
        }
        if(a.y < 0){
            a.y = 0;
            a.vy = Math.abs(a.vy);
        }
        else if(a.y >= innerHeight-margin){
            a.y = innerHeight-margin-1;
            a.vy = -Math.abs(a.vy);
        }

        if(a.vx > maxVel) a.vx = maxVel;
        else if(a.vx < -maxVel) a.vx = -maxVel;
        if(a.vy > maxVel) a.vy = maxVel;
        else if(a.vy < -maxVel) a.vy = -maxVel;
        
        a.x += a.vx;
        a.y += a.vy;

        a.update();
    }

    for(let i = 0; i < objs.length; i++){
        let o1 = objs[i];
        for(let j = i+1; j < objs.length; j++){
            let o2 = objs[j];

            let dx = (o2.x+o2.w)-(o1.x+o1.w);
            let dy = (o2.y+o2.w)-(o1.y+o1.w);
            let dist = Math.sqrt(dx**2+dy**2);
            let ang = Math.atan2(dy,dx);

            if(dist < o1.w+o2.w){
                let dif = (o2.w+o1.w) - dist;
                o1.x -= Math.cos(ang)*dif;
                o1.y -= Math.sin(ang)*dif;
                o2.x += Math.cos(ang)*dif;
                o2.y += Math.sin(ang)*dif;

                let bounceAmt1 = Math.sqrt(o1.vx**2+o1.vy**2) * colDrag;
                let bounceAmt2 = Math.sqrt(o2.vx**2+o2.vy**2) * colDrag;

                o1.vx = Math.cos(ang+Math.PI)*bounceAmt1;
                o1.vy = Math.sin(ang+Math.PI)*bounceAmt1;
                o2.vx = Math.cos(ang)*bounceAmt2;
                o2.vy = Math.sin(ang)*bounceAmt2;

                // probably should optimize these all with proportions to replace all the trig functions at some point
                
                o1.update();
                o2.update();
            }
        }
    }
}

setInterval(()=>{
    run();
},8000);
setTimeout(()=>{
    run();
},100);

// global vars
function genGlobalVars(){
    for(let i = 0; i < 50; i++){
        root.style.setProperty("--rand"+i,Math.random());
    }
}
genGlobalVars();

// let allElms = document.querySelectorAll("*");
// for(const a of allElms){
//     /**@type {HTMLElement}*/
//     let e = a;
    
//     // --cmd-gen-html: div 10
//     let gen = getComputedStyle(e).getPropertyValue("--cmd-gen-html");
//     console.log("GEN: ",gen);
//     if(gen != "" && gen != "0"){
//         let parts = gen.split(" ");
//         let amt = parseInt(parts[1]);
//         for(let i = 0; i < amt; i++){
//             let elm = document.createElement(parts[0]);
//             elm.classList.add("child","child-"+i);
//             if(parts[2]) elm.classList.add(parts[2]);
//             e.appendChild(elm);
//         }
//     }
// }

/**@type {Map<string,HTMLElement>} */
let defineHTMLReg = new Map();

/**@type {HTMLElement}*/
let __cmd;
function readCSSCmds(){
    for(const e of allCustomElms){
        removeCustomElm(e);
    }
    allCustomElms = [];

    if(__cmd) __cmd.remove();
    __cmd = document.createElement("div");
    __cmd.className = "__cmds__";
    document.body.appendChild(__cmd);
    let s = getComputedStyle(__cmd);

    let props = [
        "--cmd-define-html",
        "--cmd-gen-html",
    ];

    for(const prop of props){
        let time = 0;
        
        while(true){
            if(time > 9999) break; // max number of iterations
            
            let checkStr = prop+(time ? "-"+time : "");
            console.log("CHECK string: ",checkStr);
            
            let gen = s.getPropertyValue(checkStr);
            console.log("GEN: ",gen);

            if(gen != "" && gen != "_"){ // blank values
                // let parts = gen.split(" ");
                // let parts = gen.match(/"[^"]*"|\S+/g); // doesn't account for spaces after commas
                let parts = gen.match(/(?:[^\s"'\(\)\[\]\{\}]+|"[^"]*"|'[^']*'|\([^\)]*\)|\[[^\]]*\]|\{[^\}]*\})+/g);
                for(let i = 0; i < parts.length; i++){
                    if(parts[i].startsWith('"')) parts[i] = parts[i].substring(1,parts[i].length-1);
                }
                
                if(prop == "--cmd-gen-html"){
                    let es = document.querySelectorAll(parts[0]);
                    for(const e of es){
                        let amt = parseInt(parts[2]);
                        for(let i = 0; i < amt; i++){
                            let elm;
                            if(parts[1].startsWith("$")){
                                let partId = parts[1].substring(1);
                                elm = defineHTMLReg.get(partId).cloneNode(true);
                            }
                            else{
                                elm = document.createElement(parts[1]);
                                elm.classList.add("child","child-"+i);
                                if(parts[3]) elm.classList.add(parts[3]);
                            }
                            if(elm){
                                addCustomElm(elm);
                                e.appendChild(elm);
                            }
                        }
                    }
                }
                else if(prop == "--cmd-define-html"){
                    let id = parts[0];
                    let ops1 = JSON.parse(parts[1]);
                    let e = document.createElement(ops1[0] ?? "div");
                    e.innerHTML = parts[2];
                    if(ops1[1]) e.className = ops1[1];
                    if(ops1[2]) e.id = ops1[2];
                    if(ops1[3]) e.style = ops1[3];
                    
                    console.log("Defined new HTML part: ",e,parts[2]);
                    defineHTMLReg.set(id,e);
                }
            }
            else break;

            time++;
        }
    }
}

function addCustomElm(/**@type {HTMLElement}*/elm){
    allCustomElms.push(elm);

    if(elm.classList.contains("roundbutton")){
        setupBall(elm);
    }
}
function removeCustomElm(/**@type {HTMLElement}*/elm){
    if(elm.parentElement) elm.remove();

    if(elm.classList.contains("roundbutton")){
        let i = objs.findIndex(v=>v.ref == elm);
        if(i != -1) objs.splice(i, 1);
    }
}

//

let all = document.querySelectorAll(".roundbutton");
function setupBall(/**@type {HTMLElement}*/a){
    let o = new Obj(a);
    // a.replaceWith(o.ref);
    o.update();
    objs.push(o);
}
for(const a of all){
    let b = a.cloneNode(true);
    a.replaceWith(b);
    setupBall(b);
}

update();
run();