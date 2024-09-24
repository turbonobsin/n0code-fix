console.log("n0code tweaks loaded");

class Obj{
    constructor(/**@type {HTMLElement}*/e){
        this.ref = e.cloneNode(true);
        let a = e.querySelector("a");
        
        this.link = a.href;
        this.text = a.textContent;
        this.w = e.getBoundingClientRect().width/2;

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

let drag = 0.9;

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
        o.x = Math.random()*(innerWidth-150);
        o.y = Math.random()*(innerHeight-150);

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
    }

    for(let i = 0; i < objs.length; i++){
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

                let prog = (t-timeStart)/8000;
                o1.x -= Math.cos(ang)*o1.ldist*prog;
                o1.y -= Math.sin(ang)*o1.ldist*prog;
                o1.update();
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