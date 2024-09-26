console.log("n0code tweaks loaded");
document.body.style.overflow = "hidden";
let root = document.body.parentElement;

class RegImg{
    static async create(/**@type {File}*/f){
        let t = new RegImg();
        t.name = f.name;
        t.f = f;

        let url = URL.createObjectURL(t.f);
        t.url = url;

        t.buf = Array.from(new Uint8Array(await f.arrayBuffer()));

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
            buf:this.buf
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

    static async reload(){
        let handle = this.h;
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

        let res = await handle.requestPermission({mode:"read"});
        if(res == "denied") return;

        this.h = handle;

        localStorage.clear();
        clearCSS();

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

        console.log("REG:",reg);

        reg.registerAll();
        reg.save();
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
        let s = JSON.stringify(o);
        localStorage.setItem("__customPack",s);
    }
    static load(pack){
        let p = new CustomPack();
        for(const a of pack.images){
            p.images.push(RegImg.deserialize(a));
        }
        for(const a of pack.css){
            p.css.push(RegCSS.deserialize(a));
        }

        p.registerAll();

        curPack = p;
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
    if(e.altKey){
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
            cmds.loadPack.run();
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
});

/**@type {Record<string,{title:string,run:()=>void}>} */
let cmds = {
    loadPack:{
        title:"Load Pack",
        run:()=>{
            CustomPack.reload();
        }
    },
    regenGlobalVars:{
        title:"Regenerate Global Vars",
        run:()=>{
            genGlobalVars();
        }
    },
    reset:{
        title:"Reset Tweaks",
        run:()=>{
            localStorage.clear();
            clearCSS();
            curPack = null;
        }
    },
    customCSS:{
        title:"Apply Custom CSS File",
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

function showCmdPalette(){
    let existing = document.querySelector(".__tweaks-cmd-palette");
    if(existing){
        existing.remove();
        return;
    }
    let cont = document.createElement("div");
    cont.className = "__tweaks-cmd-palette";
    cont.style = `
        position:absolute;
        top:10px;
        left:50%;
        transform:translate(-50%,0px);
        background-color:#333;
        border:solid 1px #111;
        padding:5px;
        border-radius:5px;
    `;

    let ok = Object.keys(cmds);
    for(const id of ok){
        let cmd = cmds[id];
        let d = document.createElement("div");
        d.innerHTML = `
            <div>${cmd.title}</div>
        `;
    }

    document.body.insertBefore(cont,document.body.children[0]);
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
        this.ref = e.cloneNode(true);
        let a = this.ref.querySelector("a");
        
        this.link = a.href;
        this.text = a.textContent;
        this.w = e.getBoundingClientRect().width/2;

        this.x = Math.random()*(innerWidth-150);
        this.y = Math.random()*(innerHeight-150);

        this.ref.addEventListener("mouseenter",e=>{
            this.vx = 0;
            this.vy = 0;
            this.ax = 0;
            this.ay = 0;
            this.update();
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

let all = document.querySelectorAll(".roundbutton");
for(const a of all){
    let o = new Obj(a);
    a.replaceWith(o.ref);
    o.update();
    objs.push(o);
}

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
},500);

update();
run();

// global vars
function genGlobalVars(){
    for(let i = 0; i < 50; i++){
        root.style.setProperty("--rand"+i,Math.random());
    }
}
genGlobalVars();