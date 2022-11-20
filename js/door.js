function mapNum(x, x0, x1, y0, y1) {
    let y = (x - x0) / (x1 - x0) * (y1 - y0) + y0;
    y = Math.min(y, Math.max(y0, y1));
    y = Math.max(y, Math.min(y0, y1));
    return y;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

class Semaphore {
    constructor() {
        this.lockCode = null;
        this.lockCounter = 0;
        this.watchers = [];
    }
    async lock(parentCode) {
        if (parentCode !== undefined) {
            if (parentCode === this.lockCode) {
                this.lockCounter++
                return this.lockCode
            } else {
                let err = `Wrong parent lock code = ${parentCode}, expected ${this.lockCode}`;
                console.log(err);
                throw err;
            }
        }
        for (; ;) {
            if (this.lockCode === null) {
                this.lockCode = Math.random();
                this.lockCounter = 1;
                return this.lockCode;
            }
            let self = this;
            let p = new Promise(
                (resolve) => {
                    self.watchers.push(resolve);
                }
            );
            await p;
        }
    }
    unlock(code) {
        if (this.lockCode === null) {
            let err = "Unlock when not locked";
            console.log(err);
            throw err;
        }
        if (code !== this.lockCode) {
            let err="Wrong unlock code!";
            console.log(err);
            throw err;
        }
        if (this.lockCounter > 1) {
            this.lockCounter--;
            return false;
        }
        this.lockCode = null;
        if (this.watchers.length > 0) {
            let watcher = this.watchers.shift();
            watcher();
        }
        return true;
    }
    isWaited() {
        return this.watchers.length > 0;
    }
    isLocked() {
        return this.lockCode !== null;
    }

}

class SoundPlayer {
    constructor(playerId, timeout) {
        this.playerId = playerId;
        this.dom = $('<audio style="display:none;position:absolute"></audio>');
        this.audio = this.dom[0];
        $("body").append(this.dom);
        let self = this;
        this.audio.addEventListener('error', (e) => self.onError({ error: e }));
        this.audio.addEventListener('ended', (e) => self.onEnded({ ended: e }));
        // this.audio.addEventListener('abort', (e) => self.onError({ abort: e }));
        this.audio.addEventListener('stalled', (e) => self.onError({ stalled: e }));
//        this.audio.addEventListener('suspend', (e) => self.onError({ suspend: e }));
        this.audio.volume = 1;
        this.queue = [];
        this.flagPlaying = false;
        this.timeout = timeout;
    }
    setVolume(v) {
        this.audio.volume = v;
    }
    isPlaying() {
        return this.flagPlaying;
    }
    onEnded(e) {
        console.log(`${this.playerId} audio event ${ JSON.stringify(e) }`);
        this.playNext();
    }
    onError(e) {
        console.log(`${this.playerId} audio event ${JSON.stringify(e)}`);
        this.playNext();
    }
    cancelMySpeech(who) {
        let newQueue = this.queue.filter((x) => !Object.is(x["who"], who));
        this.queue = newQueue;
    }
    abort() {
        this.audio.src = "";
        this.queue = [];
        this.flagPlaying = false;
        if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
        console.log(`${this.playerId} abort`);
    }
    playNext() {
        if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
        if (this.queue.length > 0) {
            this.flagPlaying = true;
            
            let playItem = this.queue.shift();
            let url = playItem.url;
            let self = this;
            self.audio.src = "";
            self.audio.src = url;
            console.log(`${this.playerId} Next play ${this.audio.src}`)
            self.audio.play();
            if (this.timeout) {
                this.timeoutTimer=setTimeout(() => self.abort(), this.timeout);
            }
        } else {
            if (this.flagPlaying) {
//                this.audio.pause();
//                this.audio.src = "";
                console.log(`${this.playerId} Stop play`);
                this.flagPlaying = false;
            }
        }
    }
    play(playItem) {
        if (typeof playItem == 'string') {
            playItem = { who: undefined, url: playItem };
        }
        this.queue.push(playItem);
        console.log(`${this.playerId} Add to play ${playItem.url}`);
        if (!this.isPlaying()) this.playNext();
    }
}

class Door {
    constructor() {
        this.dom = $(
            '<div class=door><div class=kosyak><div class=darkspace></div><div class=doort></div></div></div>'
        );
        this.kosyak = $('.kosyak', this.dom);
        this.darkspace = $('.darkspace', this.dom);
        this.doort = $('.doort', this.dom);
        this.semaphore = new Semaphore();
        this.visitors = new Map();
    }
    setSize(w, h) {
        this.w = w;
        this.h = h;
        setOutherSize(this.dom, w, h);
        setOutherSize(this.kosyak, w, h);
        this.kosyak.css('background-size', `${w}px ${h}px`);
        setOutherSize(this.darkspace, w * 0.85, h * 0.96);
        setOutherSize(this.doort, w * 0.85, h * 0.96);
        this.doort.css('background-size', `${w * 0.85}px ${h * 0.96}px`);
        place(this.kosyak, { my: "center center", at: "center center", of: this.dom });
        place(this.darkspace, { my: "center bottom", at: "center bottom-1%", of: this.kosyak });
        place(this.doort, { my: "center bottom", at: "center bottom-1%", of: this.kosyak });
        let self = this;
        this.visitors.forEach(
            (state,chel) => {
                switch (state) {
                    case "in": self._visitorIn(chel); break;
                    case "out": self._visitorOut(chel); break;
                }
            }
        );
    }
    setOpenValue(v) {
        let x = mapNum(v, 0, 1, 0, this.w * 0.85);
        this.doort.css("background-position-x", `${x}px`);
    }
    async open(dur, parentLockCode) {
        let lockCode = await this.semaphore.lock(parentLockCode);
        let t0 = Date.now();
        let t1 = t0 + dur;
        for (; ;) {
            await sleep(20);
            let t = Date.now();
            if (t >= t1) break;
            this.setOpenValue(mapNum(t, t0, t1, 0, 1));
        }
        this.setOpenValue(1);
        this.semaphore.unlock(lockCode);
    }
    async close(dur, parentLockCode) {
        let lockCode = await this.semaphore.lock(parentLockCode);
        let t0 = Date.now();
        let t1 = t0 + dur;
        for (; ;) {
            await sleep(20);
            let t = Date.now();
            if (t >= t1) break;
            this.setOpenValue(mapNum(t, t0, t1, 1, 0));
        }
        this.setOpenValue(0);
        this.semaphore.unlock(lockCode);
    }
    _visitorIn(chel) {
        chel.setSize(this.w * 0.8, this.h * 0.8);
        this.darkspace.after(chel.dom);
        place(chel.dom, { my: "center bottom", at: "center bottom-1%", of: this.darkspace });
    }
    _visitorOut(chel) {
        chel.setSize(this.w, this.h);
        this.kosyak.after(chel.dom);
        place(chel.dom, { my: "center bottom", at: "center bottom+2%", of: this.kosyak });
    }
    visitorIn(chel) {
        if (chel.whereI && chel.whereI!=this) chel.whereI.visitorAway(chel);
        this._visitorIn(chel);
        this.visitors.set(chel, "in");
        chel.whereI = this;
    }
    visitorOut(chel) {
        if (chel.whereI && chel.whereI != this) chel.whereI.visitorAway(chel);
        this._visitorOut(chel);
        this.visitors.set(chel, "out");
        chel.whereI = this;
    }
    visitorAway(chel) {
        this.visitors.delete(chel);
        chel.whereI = undefined;
    }
    async visitorEnter(chel) {
        let lockCode = await this.semaphore.lock();
        this.visitorOut(chel);
        await this.open(1000, lockCode);
        this.visitorIn(chel);
        await this.close(1000, lockCode);
        this.semaphore.unlock(lockCode);
    }
    async visitorExit(chel) {
        let lockCode = await this.semaphore.lock();
        this.visitorIn(chel);
        await this.open(1000, lockCode);
        this.visitorOut(chel);
        await this.close(1000, lockCode);
        this.semaphore.unlock(lockCode);
    }
}

class Chelovechek {
    constructor(index) {
        this.dom = $('<div class=chelovechek></div>');
        this.indexh = index % 10;
        this.indexv = Math.floor(index/10);
    }
    setSize(w, h) {
        setOutherSize(this.dom, w, h);
        this.dom.css("background-size", `${w*10}px ${h*4}px`);
        this.dom.css("background-position", `${-this.indexh * w}px ${-this.indexv * h}px`);
    }
}

class Wall {
    constructor(stage) {
        this.dom = $(`<div class="wall"><div class=stageNumer><span>${stage}<span></div></div>`);
        this.dom.css('background-color', `hsl(${randFlt(0,360)}, 25%, 75%)`);
        if (stage <= 0) {
            let cls;
            switch (stage) {
                case 0: cls = 'street'; break;
                case -1: cls = 'shop'; break;
                case -2: cls = 'park1'; break;
                case -3: cls = 'park2'; break;
                default: cls = 'wall'; break;
            }
            let dom1 = $(`<div class="${cls} rightStageImage"></div>`);
            this.dom.append(dom1);
        }
    }
    setSize(w, h) {
        this.w = w;
        this.h = h;
        this.innerSize=setOutherSize(this.dom, w, h);
        $('.stageNumer', this.dom).css('font-size', `${h / 3}px`);
        place($('.stageNumer', this.dom), { my: "left center", at: `left+${w/40} center`, of: this.dom });
    }
}

class Stage {
    constructor(stage) {
        this.dom = $(`<div class="Stage"></div>`);
        this.wall = new Wall(stage);
        this.dom.append(this.wall.dom);
        this.doors = [];
        if (stage > 0) {
            for (let i = 0; i < 3; i++) {
                let door = new Door();
                this.doors.push(door);
                this.dom.append(door.dom);
            }
        }
        this.visitors = new Map();
    }
    setSize(w, h) {
        let innerSize = setOutherSize(this.dom, w, h);
        this.innerSize = innerSize;
        this.wall.setSize(innerSize.w, innerSize.h);
        place(this.wall.dom, { my: "center bottom", at: "center bottom", of: this.dom });
        let dw = this.wall.dom.width() / 7;
        let dh = this.wall.dom.height() * 0.75;
        this.doorw = dw;
        this.doorh = dh;
        this.chelw = dw;
        this.chelh = dh;
        for (let i = 0; i < this.doors.length; i++) {
            let door = this.doors[i];
            door.setSize(dw, dh);
            place(door.dom, { my: "left bottom", at: `left+${(i * 2 + 1) * dw} bottom`, of: this.wall.dom });
        }
        let self=this;
        this.visitors.forEach( (state, chel) => self._setChelSizePos(chel,state) );
    }
    _setChelSizePos(chel, state) {
        chel.setSize(this.chelw, this.chelh);
        this._setChelPos(chel, state);
    }
    _setChelPos(chel, state) {
        place(chel.dom, { my: "left bottom", at: `left+${state.x * (this.innerSize.w - this.chelw - this.innerSize.r) + this.innerSize.l} bottom`, of: this.dom });
    }
    visitorOn(chel, x) {
        if (chel.whereI && chel.whereI != this) chel.whereI.visitorAway(chel);
        let state = this.visitors.get(chel);
        if (state === undefined) {
            state = { x: x };
            this.visitors.set(chel, state);
            chel.whereI = this;
            this.dom.append(chel.dom);
            this._setChelSizePos(chel, state)
        } else {
            state.x = x;
            this._setChelPos(chel, state);
        }
    }
    visitorAway(chel) {
        this.visitors.delete(chel);
        chel.whereI = undefined;
    }
    getDoorX(i) {
        if (i >= this.doors.length) return undefined;
        let doorx = (i * 2 + 1) * this.doorw;
        let x = (doorx - this.innerSize.l) / (this.innerSize.w - this.chelw - this.innerSize.r);
        return x;
    }
    async moveOnStage(chel, x) {
        let state = this.visitors.get(chel);
        if (state === undefined) {
            this.visitorOn(chel, x);
            return;
        }
        if (state.semaphore === undefined) state.semaphore = new Semaphore();
        let lockCode = await state.semaphore.lock();
        let x0 = state.x;
        let dist = x - x0;
        let speed = Math.min(Math.max(dist, -0.0025), 0.0025);
        speed += randFlt(-0.0002, 0.0002);
        let numSteps = dist / speed;
        for (let t = 1; t <= numSteps; t++) {
            await sleep(20);
            state.x = speed * t + x0;
            this._setChelPos(chel, state);
            if (state.semaphore.isWaited()) break;
        }
        state.semaphore.unlock(lockCode);
    }
}

class Floor {
    constructor() {
        this.dom = $(`<div class="floor"></div>`);
    }
    setSize(w, h) {
        setOutherSize(this.dom, w, h);
    }
}

class Roof {
    constructor() {
        this.dom = $(`<div class="roof"></div>`);
    }
    setSize(w, h) {
        setOutherSize(this.dom, w, h);
        this.dom.css("background-size", `${w}px ${h}px`);
    }
}


class Lift {
    constructor() {
        this.dom = $(`<div class="lift"><div class=lift-wall></div><div class=cabin></div><div class=cabin-tros></div><div class=lift-rabica></div></div>`);
        this.wall = { dom: $('.lift-wall', this.dom) };
        this.cabin = { dom: $('.cabin', this.dom) };
        this.rabica = { dom: $('.lift-rabica', this.dom) };
        this.tros = { dom: $('.cabin-tros', this.dom) };
        this.moveController = new MoveFilter();
        this.moveController.setup(0.5, 0.25, -100, 100);
        this.semaphore = new Semaphore();
        this.listeners = new Listeners();
        this.setCabinStage(0);
        this.visitors = new Map();
    }
    setSize(w, hCabin, hStage, minStage, maxStage) {
        let numStages = maxStage - minStage + 1;
        let h = hStage * numStages;
        this.minStage = minStage;
        this.maxStage = maxStage;
        this.w = w
        this.h = h
        this.hCabin = hCabin;
        this.hStage = hStage;
        setOutherSize(this.dom, w, h);
        setOutherSize(this.wall.dom, w, h);

        let cis = setOutherSize(this.cabin.dom, w * 0.9, hCabin);
        this.cabinInnerSize = cis;
        this.cabin.dom.css("background-size", `${cis.w}px ${cis.h}px`);

        setOutherSize(this.tros.dom, this.w * 0.2, 10);
        place(this.tros.dom, { my: "center top", at: `center top`, of: this.dom });

        setOutherSize(this.rabica.dom, w, h);
        place(this.wall.dom, { my: "left top", at: `left top`, of: this.dom });
        place(this.rabica.dom, { my: "left top", at: `left top`, of: this.dom });

        this._setCabinStage(this.moveController.getPosition().x);

        let self = this;
        this.visitors.forEach(
            (state, chel) => {
                switch (state) {
                    case "in": self._visitorIn(chel); break;
                    case "out": self._visitorOut(chel); break;
                }
            }
        );
    }
    _setCabin(y) {
        place(this.cabin.dom, { my: "center top", at: `center top+${y}`, of: this.dom });
        setOutherSize(this.tros.dom, this.w * 0.2, y);
    }
    _setCabinStage(si, hook) {
        let y = (this.maxStage - si) * this.hStage;
        this._setCabin(y);
        if (hook) hook(this, y);
        return y;
    }
    setCabinStage(si) {
        this.moveController.setState(si, 0);
        return this._setCabinStage(si);
    }
    async moveToStage(si, hook) {
        console.log("Starting moveToStage", si);
        let lockCode=await this.semaphore.lock();
        if (this.moveController.getPosition().x == si) {
            console.log("Already on stage", si);
            this.semaphore.unlock(lockCode);
            return;
        }
        console.log("Started moveToStage", si);
        let res = this.moveController.setTarget(si);
        this.listeners.fireEvent({ event: 'startMoving', target: si, direction: res.direction });
        for (; ;) {
//            console.log(res);
            let y=this._setCabinStage(res.x, hook);
            this.listeners.fireEvent({ event: "moving", stage: res.x, y: y, direction: res.direction });
            if (res.done) break;
            if (this.semaphore.isWaited()) break;
            await sleep(20);
            res = this.moveController.getPosition();
        }
        console.log("Finished moveToStage", si);
        this.listeners.fireEvent({ event: 'stopMoving', target: si, direction: res.direction });
        this.semaphore.unlock(lockCode);
    }
    isMoving() {
        return this.semaphore.isLocked();
    }
    getCurrentStage() {
        return Math.round(this.moveController.getPosition().x);
    }
    _visitorIn(chel) {
        chel.setSize(this.cabinInnerSize.w * 0.8, this.cabinInnerSize.h * 0.8);
        this.cabin.dom.append(chel.dom);
        place(chel.dom, { my: "center bottom", at: `center+${randFlt(-20,20)}% bottom-5%`, of: this.cabin.dom });
    }
    _visitorOut(chel) {
        chel.setSize(this.cabinInnerSize.w, this.cabinInnerSize.h);
        this.rabica.dom.after(chel.dom);
        place(chel.dom, { my: "left bottom", at: "right bottom", of: this.cabin.dom });
    }
    visitorIn(chel) {
        if (chel.whereI && chel.whereI != this) chel.whereI.visitorAway(chel);
        this._visitorIn(chel);
        this.visitors.set(chel, "in");
        chel.whereI = this;
    }
    visitorOut(chel) {
        if (chel.whereI && chel.whereI != this) chel.whereI.visitorAway(chel);
        this._visitorOut(chel);
        this.visitors.set(chel, "out");
        chel.whereI = this;
    }
    visitorAway(chel) {
        this.visitors.delete(chel);
        chel.whereI = undefined;
    }
    async visitorEnter(chel) {
        this.visitorIn(chel);
    }
    async visitorExit(chel) {
        this.visitorOut(chel);
    }

}

class MoveFilter {
    setup(maxSpeed, maxAccel, minOut, maxOut) {
        this.maxSpeed = maxSpeed/1000;
        this.maxAccel = maxAccel/1000000;
        this.minOut = minOut;
        this.maxOut = maxOut;
        this.setState();
    }
    setState(x, v) {
        this.x = x || 0;
        this.v = v || 0;
        this.done = true;
    }
    setTarget(t) {
        this.getPosition();

        this.target = Math.max(Math.min(t, this.maxOut), this.minOut);
        this.direction = Math.sign(this.target - this.x);
        let a1 = this.maxAccel * this.direction;
        let a3 = -a1;
        let v2 = this.maxSpeed * this.direction;
        let dt1 = (v2 - this.v) / a1;
        let dt3 = (0 - v2) / a3;
        let x1 = a1 * dt1 * dt1 / 2 + this.v * dt1 + this.x;
        let x2 = this.target - a3 * dt3 * dt3 / 2 - v2 * dt3;
        let dt2 = (x2 - x1) / v2;

        this.t0 = Date.now();
        this.t1 = this.t0 + dt1;
        this.t2 = this.t1 + dt2;
        this.t3 = this.t2 + dt3;
        this.a1 = a1;
        this.a3 = a3;
        this.v0 = this.v;
        this.v1 = v2;
        this.v2 = v2;
        this.v3 = 0;
        this.x0 = this.x;
        this.x1 = x1;
        this.x2 = x2;
        this.x3 = this.target;
        this.done = false;
//        console.log(this);
        return this.getPosition();
    }
    getPosition() {
        if (!this.done) {
            let t = Date.now();
            let b;
            if (this.t2 > this.t1) {
                if (t < this.t1) b = 1;
                else if (t < this.t2) b = 2;
                else if (t < this.t3) b = 3;
                else b = 4;
            } else {
                let t12 = (this.v2 - this.v0 - this.a3 * this.t2 + this.a1 * this.t0) / (this.a1 - this.a3);
                if (t < t12) b = 1;
                else if (t < this.t3) b = 3;
                else b = 4;
            }
            switch (b) {
                case 1: {
                    let dt = t - this.t0;
                    this.x = this.a1 * dt * dt / 2 + this.v0 * dt + this.x0;
                    this.v = this.a1 * dt + this.v0;
                    break;
                }
                case 2: {
                    let dt = t - this.t1;
                    this.x = this.v1 * dt + this.x1;
                    this.v = this.v1;
                    break;
                }
                case 3: {
                    let dt = t - this.t2;
                    this.x = this.a3 * dt * dt / 2 + this.v2 * dt + this.x2;
                    this.v = this.a3 * dt + this.v2;
                    break;
                }
                default: {
                    this.x = this.x3;
                    this.v = this.v3;
                    this.done = true;
                    break;
                }
            }
        }
        return { x: this.x, v: this.v, direction: this.direction, done: this.done };
    }
}

class Listeners {
    constructor() {
        this.listeners = [];
    }
    delListener(f) {
        let i = this.listeners.findIndex(f1 => Object.is(f, f1));
        if (i >= 0) this.listeners.splice(i, 1);
    }
    addLisener(f) {
        this.delListener(f);
        this.listeners.push(f);
    }
    fireEvent(data) {
        for (let l of this.listeners) l(data);
    }
}

class LiftController {
    constructor(minStage, maxStage, numCols) {
        this.minStage = minStage;
        this.maxStage = maxStage;
        this.numCols = numCols;
        this.numButtons = this.maxStage - this.minStage + 1;
        this.numRows = Math.ceil(this.numButtons / this.numCols);

        this.dom = $(
            '<div class=liftPanel>' +
                '<div class=liftIndictor><span></span></div><div class=liftButtons></div>' + 
                '<table class=musicPanel><tr><td><input class=musicVolume type=range min=0 max=1 step=0.1 value=0.2></td><td><input class=nextTrack type=button value=">>"></td></tr></table>' +
            '</div >'
        );
        this.indicator = { dom: $('.liftIndictor', this.dom) };
        this.buttons = {
            buttons: {},
            dom: $('.liftButtons', this.dom)
        };

        this.volumeControl = { dom: $('.musicPanel', this.dom) };

        let self = this;
        for (let si = minStage; si <= maxStage; si++) {
            let button = { dom: $(`<div class=liftButton><span>${si}</span></div>`) };
            this.buttons.buttons[si] = button;
            this.buttons.dom.append(button.dom);
            button.dom.click(() => { self.listeners.fireEvent({ event: "click", value: si }) });
        }
        this.listeners = new Listeners();
    }
    setSize(w, h) {
        let ids = setOutherSize(this.dom, w, h);

        let ies = { w: ids.w * 0.9, h: ids.h * 0.9 * 0.25 };
        let iis = setOutherSize(this.indicator.dom, ies.w, ies.h);
        this.indicator.dom.css('font-size', `${ies.h / 2}px`);

        let bes = { w: ids.w * 0.9, h: ids.h * 0.9 * 0.7 }
        let bis = setOutherSize(this.buttons.dom, bes.w, bes.h);

        let mes = { w: ids.w * 0.9, h: ids.h * 0.9 * 0.05 };
        let mis = setOutherSize(this.volumeControl.dom, mes.w, mes.h);

        let ch = ies.h + mes.h + bes.h;

        place(this.indicator.dom, { my: "left top", at: `left+${(ids.w - ies.w) / 2 + ids.l} top+${(ids.h-ch)/2+ids.t}`, of: this.dom });
        place(this.buttons.dom, { my: "left top", at: `left bottom`, of: this.indicator.dom });
        place(this.volumeControl.dom, { my: "left top", at: `left bottom`, of: this.buttons.dom });

        let wButt = bis.w / this.numCols;
        let hButt = bis.h / this.numRows;
        let whButt = Math.min(wButt, hButt);
        let lMargin = (bis.w - whButt * this.numCols) / 2 + (bes.w - bis.w) / 2;
        let tMargin = (bis.h - whButt * this.numRows) / 2 + (bes.h - bis.h) / 2;
        for (let si = minStage; si <= maxStage; si++) {
            let si0 = si - minStage;
            let col = si0 % this.numCols;
            let row = this.numRows - Math.floor(si0 / this.numCols);
            let x = col * whButt + lMargin;
            let y = (row-1) * whButt + tMargin;
            setOutherSize(this.buttons.buttons[si].dom, whButt-4, whButt-4);
            place(this.buttons.buttons[si].dom, { my: "left top", at: `left+${x + 2} top+${y + 2}`, of: this.buttons.dom });
            this.buttons.buttons[si].dom.css('font-size', `${whButt/2}px`);
        }
    }
    highlightButton(si) {
        for (let si1 in this.buttons.buttons) {
            if (si !== undefined && si1 == Math.round(si)) {
                this.buttons.buttons[si1].dom.addClass('highlight');
            } else {
                this.buttons.buttons[si1].dom.removeClass('highlight');
            }
        }
    }
    display(text) {
        $("span", this.indicator.dom).text(text);
    }
}

function randomSelect(...choices) {
    return choices[randInt(0,choices.length-1)];
}
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFlt(min, max) {
    return Math.random() * (max - min) + min;
}   
function createPromise() {
    let r, f;
    let p = new Promise((_r, _f) => { r = _r; f = _f; });
    p.resolve = r;
    p.reject = f;
    return p;
}

async function waitForLift(lift, stageNum) {
    for (; ;) {
        if (!lift.isMoving() && (stageNum===undefined || lift.getCurrentStage() == stageNum)) return true;

        let p = createPromise();
        let listener = (event) => {
            if (event.event == "stopMoving" && (stageNum === undefined || event.target == stageNum)) p.resolve();
        }
        lift.listeners.addLisener(listener);
        await p;
        lift.listeners.delListener(listener);
    }
}

async function chelSpeakTarget(building, chel, voice, currStage, targetStage, wish) {
    if (currStage == targetStage) return;
    let urls=[];
    if (targetStage > currStage && targetStage - currStage <= 5) {
        urls.push( `sounds/${voice}/up${targetStage - currStage}.mp3` );
    } else if (targetStage < currStage && currStage - targetStage <= 5) {
        urls.push( `sounds/${voice}/down${currStage - targetStage}.mp3` );
    } else if (targetStage <= 0) {
        urls.push( `sounds/${voice}/to${targetStage}.mp3` );
    } else {
        switch (wish) {
            case 'toHome': urls.push(`sounds/${voice}/tohome.mp3`); break;
            case 'visiting': urls.push(`sounds/${voice}/tovisit.mp3`); break;
        }
        urls.push(`sounds/${voice}/to${targetStage}.mp3`);
    }
    building.soundPlayer.cancelMySpeech(chel);
    for (let url of urls) {
        building.soundPlayer.play({ who: chel, url: url });
    }
}

let maxNumPassengers = 2;
let chelVoices = [
    "m", "m1", "f", "m2", "f", "m1", "m", "m1", "m2", "f",
    "m2", "m", "m1", "f", "k1", "m1", "m2", "m1", "k1", "m1"
];

async function chelovechekLive(building, myIndex) {
    let lift = building.lift;
    let stages = building.stages;
    if (!building.liftUserSemaphore) {
        building.liftUserSemaphore = new Semaphore();
        building.liftCounter = 0;
    }
    let me = new Chelovechek(myIndex);
    let myVoice = chelVoices[myIndex];
    let myStageNum = randInt(building.minStage,building.maxStage);
    let myStage = stages[myStageNum];
    let myDoorNum = undefined;
    let myDoor = null;
    if (myStage.doors.length > 0) {
        myDoorNum = randInt(0, myStage.doors.length - 1);
        myDoor = myStage.doors[myDoorNum];
    }
    let state = {
        stageNum: myStageNum,
        stage: myStage,
        doorNum: myDoorNum,
        door: myDoor,
    }
    if (state.door) {
        await state.door.visitorIn(me);
    } else {
        await state.stage.visitorOn(me, randFlt(0.5,1));
    }

    for (; ;) {
        let iWant;
        if (state.door) {
            if (state.door === myDoor) {    //I'm at home
                await sleep(randFlt(0,30000));
                iWant = randomSelect("walking", "visiting");
            } else {    // visiting
                await sleep(randFlt(0, 30000))
                if (myDoor) iWant = randomSelect("walking", "visiting", "toHome");
                else iWant = randomSelect("walking", "visiting");
            }
        } else { // I'm walking
            if (myDoor) iWant = randomSelect("walking", "visiting", "toHome");
            else iWant = randomSelect("walking", "visiting");
        }

        let targetStageNum, targetDoorNum;
        let targetStage, targetDoor;
        switch (iWant) {
            case "walking":
                if (state.stageNum<=0 && randInt(0, 4) != 0) {
                    targetStageNum = state.stageNum;
                    targetStage = state.stage;
                } else {
                    targetStageNum = randInt(building.minStage, 0);
                    targetStage = stages[targetStageNum];
                }
                targetDoorNum = undefined;
                targetDoor = undefined;
                break;
            case "visiting":
                if (state.stageNum >= 1 && randInt(0, 4) != 0) {
                    targetStageNum = state.stageNum;
                    targetStage = state.stage;
                } else {
                    targetStageNum = randInt(1, building.maxStage);
                    targetStage = stages[targetStageNum];
                }
                for (; ;) {
                    targetDoorNum = randInt(0, targetStage.doors.length - 1);
                    targetDoor = targetStage.doors[targetDoorNum];
                    if (targetDoorNum != state.doorNum || targetStageNum != state.stageNum) break;
                }
                break;
            case "toHome":
                targetStageNum = myStageNum;
                targetStage = myStage;
                targetDoorNum = myDoorNum;
                targetDoor = myDoor;
                break;
            default:
                throw `Unknown wish ${iWant}`;
        }

        if (state.door) {
            await state.door.visitorExit(me);
            await state.stage.visitorOn(me, state.stage.getDoorX(state.doorNum));
            state.door = undefined;
            state.doorNum = undefined;
        }

        if (targetStageNum != state.stageNum) {
            for (; ;) {
                await state.stage.moveOnStage(me, randFlt(0.1, 0.25));
                await waitForLift(lift, state.stageNum);
                let liftLockCode = await building.liftUserSemaphore.lock();
                await state.stage.moveOnStage(me, 0);
                if (!lift.isMoving() && lift.getCurrentStage() == state.stageNum && building.liftCounter<maxNumPassengers) {
                    await lift.visitorEnter(me);
                    building.liftCounter++;
                    building.liftUserSemaphore.unlock(liftLockCode);
                    break;
                }
                building.liftUserSemaphore.unlock(liftLockCode);
            }
            {
                for (; ;) {
                    if (!lift.isMoving() && lift.getCurrentStage() == targetStageNum) break;
                    console.log(`Want to be in ${targetStageNum} floor, door=${targetDoorNum}, wish=${iWant}`);
                    chelSpeakTarget(building, me, myVoice, state.stageNum, targetStageNum, iWant);
                    let p = createPromise();
                    let l = (event) => { if (event.event == 'stopMoving') p.resolve() };
                    lift.listeners.addLisener(l);
                    await p;
                    lift.listeners.delListener(l);
                    state.stageNum = lift.getCurrentStage();
                    state.stage = stages[state.stageNum];
                }
            }
            await lift.visitorExit(me);
            await lift.visitorAway(me);
            building.liftCounter--;
            state.stageNum = targetStageNum
            state.stage = targetStage;
            state.stage.visitorOn(me, 0);
        }

        if (targetDoor) {
            await state.stage.moveOnStage(me, state.stage.getDoorX(targetDoorNum));
            await targetDoor.visitorEnter(me);
            state.doorNum = targetDoorNum;
            state.door = targetDoor;
        } else {
            await state.stage.moveOnStage(me, randFlt(0.5, 1));
        }
    }
}