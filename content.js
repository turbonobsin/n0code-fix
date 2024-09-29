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

/**@type {Record<string,{title:string,run:()=>void,key:string}>} */
let cmds = {
    loadPack:{
        title:"Load Pack",
        key:"Alt+F",
        run:()=>{
            CustomPack.reload();
        }
    },
    regenGlobalVars:{
        title:"Regenerate Global Vars",
        key:"Alt+G",
        run:()=>{
            genGlobalVars();
        }
    },
    reset:{
        title:"Reset Tweaks",
        key:"Alt+R",
        run:()=>{
            localStorage.clear();
            clearCSS();
            curPack = null;
        }
    },
    customCSS:{
        title:"Apply Custom CSS File",
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
        z-index:999;
        color:#eee;
        font-size:10px;
        box-shadow:0px 5px 10px rgba(0,0,0,0.3);
    `;

    let ok = Object.keys(cmds);

    let heading = document.createElement("div");
    heading.innerHTML = `
        <div style="margin:5px;font-size:11px;color:#ccc;margin-bottom:5px">Command Palette</div>
    `;
    cont.appendChild(heading);
    let hr = document.createElement("hr");
    hr.style.margin = "5px";
    cont.appendChild(hr);

    for(const id of ok){
        let cmd = cmds[id];
        let d = document.createElement("div");
        d.innerHTML = `
            <div>${cmd.title}</div>
            <div style="color:#ccc;font-size:8px">${cmd.key}</div>
        `;
        d.style = `
            display:flex;
            align-items:center;
            justify-content:space-between;
            padding:4px 7px;
            user-select:none;
            -webkit-user-select:none;
            border-radius:3px;
            gap:30px;
            cursor:pointer;
        `;
        cont.appendChild(d);

        d.addEventListener("mouseenter",e=>{
            d.style.backgroundColor = "#555";
        });
        d.addEventListener("mouseleave",e=>{
            d.style.backgroundColor = null;
        });

        d.addEventListener("click",e=>{
            cmd.run();
            cont.remove();
        });
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
},500);

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

function readCSSCmds(){
    let __cmd = document.createElement("div");
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
                let parts = gen.split(" ");
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
                            if(elm) e.appendChild(elm);
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
                    
                    console.log("Defined new HTML part: ",e);
                    defineHTMLReg.set(id,e);
                }
            }
            else break;

            time++;
        }
    }
}
readCSSCmds();

// 

let all = document.querySelectorAll(".roundbutton");
for(const a of all){
    let o = new Obj(a);
    a.replaceWith(o.ref);
    o.update();
    objs.push(o);
}

update();
run();