console.log("n0code tweaks loaded");
document.body.style.overflow = "hidden";

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

    if(true) for(let i = 0; i < objs.length; i++){
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