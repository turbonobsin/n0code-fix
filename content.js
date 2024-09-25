console.log("n0code tweaks loaded");

class Obj{
    constructor(/**@type {HTMLElement}*/e){
        this.ref = e.cloneNode(true);
        let a = this.ref.querySelector("a");

        // this.ref.style.transform = "translate(-50%,-50%)";
        
        this.link = a.href;
        this.text = a.textContent;
        this.w = this.ref.getBoundingClientRect().width/2;

        this.x = Math.random()*(innerWidth-150);
        this.y = Math.random()*(innerHeight-150);
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

let aDrag = 0.75;
let vDrag = 0.75;

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
        // o.x = Math.random()*(innerWidth-150);
        // o.y = Math.random()*(innerHeight-150);

        let ang = Math.random()*6.28;
        let amt = 20;
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
        // a.ref.style.transition = `top 5s ease-in-out, left 5s ease-in-out, background-color 1s`;
        a.ref.style.transition = `top 5s ease-in-out, left 5s ease-in-out`;

        a.ax *= aDrag;
        a.ay *= aDrag;
        a.vx *= vDrag;
        a.vy *= vDrag;

        a.vx += a.ax;
        a.vy += a.ay;
        
        a.x += a.vx;
        a.y += a.vy;

        let margin = a.w;
        if(a.x < margin){
            a.x = margin;
            a.vx = Math.abs(a.ax);
        }
        else if(a.x >= innerWidth-margin){
            a.x = innerWidth-margin-1;
            a.vx = -Math.abs(a.vx);
        }
        if(a.y < margin){
            a.y = margin;
            a.vy = Math.abs(a.ay);
        }
        else if(a.y >= innerHeight-margin){
            a.y = innerHeight-margin-1;
            a.vy = -Math.abs(a.vy);
        }
    }

    if(true) for(let i = 0; i < objs.length; i++){
        let o1 = objs[i];
        for(let j = i+1; j < objs.length; j++){
            let o2 = objs[j];

            let dx = o2.x-o1.x;
            let dy = o2.y-o1.y;
            let dist = Math.sqrt(dx**2+dy**2);
            let ang = Math.atan2(dy,dx);

            if(dist < o1.w+o2.w){
                // o1.vx -= dx/2;
                // o1.vy -= dy/2;
                // o2.vx += dx/2;
                // o2.vy += dy/2;
                o1.x -= dx/2;
                o1.y -= dy/2;
                o2.x += dx/2;
                o2.y += dy/2;
            }
        }
    }
    
    if(false) for(let i = 0; i < objs.length; i++){
        let o1 = objs[i];
        let r1 = o1.ref.getBoundingClientRect();
        // if(t-o1.lastCol < 500) continue;
        for(let j = i+1; j < objs.length; j++){
            let o2 = objs[j];
            // if(t-o2.lastCol < 500) continue;
            let r2 = o2.ref.getBoundingClientRect();

            let dx = r2.x-r1.x;
            let dy = r2.y-r1.y;
            let dist = Math.sqrt(dx**2+dy**2);
            let ang = Math.atan2(dy,dx);

            if(dist < o1.w+o2.w){
                // collision

                // o1.lastCol = performance.now();
                // o2.lastCol = performance.now();

                o1.ref.style.backgroundColor = "black";
                o2.ref.style.backgroundColor = "black";

                let prog = (t-timeStart)/8000 / 4;
                o1.x -= Math.cos(ang)*o1.ldist*prog;
                o1.y -= Math.sin(ang)*o1.ldist*prog;
                o2.x += Math.cos(ang)*o2.ldist*prog;
                o2.y += Math.sin(ang)*o2.ldist*prog;
                o1.update();
                o2.update();
            }
        }
    }
}
update();

setInterval(()=>{
    run();
},8000);
run();
setTimeout(()=>{
    run();
},500);
// setTimeout(()=>{
    // update();
// },2500);