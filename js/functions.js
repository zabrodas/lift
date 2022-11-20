function getLeftBorderSize(e) {
    return parseInt(e.css('border-left-width'), 10);
}
function getRightBorderSize(e) {
    return parseInt(e.css('border-right-width'), 10);
}
function getTopBorderSize(e) {
    return parseInt(e.css('border-top-width'), 10);
}
function getBottomBorderSize(e) {
    return parseInt(e.css('border-bottom-width'), 10);
}

function domChangeParent(e, newParent) {
    newParent.append(e);
    return e.position();
}

function getInnerSize(e) {
    return {
        w: e.width(),
        h: e.height(),
        l: getLeftBorderSize(e),
        r: getRightBorderSize(e),
        t: getTopBorderSize(e),
        b: getBottomBorderSize(e),
        wb: e.outerWidth(),
        hb: e.outerHeight(),
        wm: e.outerWidth(true),
        hm: e.outerHeight(true)
    };
}

function setOutherSize(e, w, h) { // set outer size, return inner size
    e.outerHeight(h).outerWidth(w);
    return getInnerSize(e);
}

function place(e,opts) {
    e.css("position","absolute");
    opts.collision  = opts.collision  || "none";
    e.position(opts);
}

function onResizeWindow(building) {
    var w=$(window).width();
    var h=$(window).height();
    var mcs = setOutherSize($(".maincontent"), w, h);

    let pis =setOutherSize($('#panel'), w / 4, h);
    let bis= setOutherSize(building.dom, w * 3 / 4, h);
    place($('#panel'), { my: "left top", at: `left top`, of: ".maincontent" });
    building.liftController.setSize(pis.w*0.9, pis.h*0.9);
    place(building.liftController.dom, { my: "center center", at: `center center`, of: "#panel" });

    place(building.dom, { my: "left top", at: `right top`, of: "#panel" });

    building.dom.scrollTop(0);

    let hStage = h / 3.5;
    let wLift = hStage;
    let wFloor = Math.min(w*3/4, hStage*5);
    let wStage = wFloor - wLift;

    building.roof.setSize(wFloor, hStage);
    place(building.roof.dom, { my: "left top", at: `left top`, of: building.dom });

    let hTotal = 0;
    for (let si = minStage; si <= maxStage; si++) {
        let stage = building.stages[si];
        stage.setSize(wStage, hStage); hTotal += hStage;
        let floor = building.floors[si];
        floor.setSize(wFloor, hStage / 5); hTotal += hStage / 5;
    }

    let prev = building.roof;
    for (let si = maxStage; si >= minStage; si--) {
        place(building.stages[si].dom, { my: "left top", at: `left+${wLift} bottom`, of: prev.dom });
        place(building.floors[si].dom, { my: "left top", at: `left-${wLift} bottom`, of: building.stages[si].dom });
        prev = building.floors[si];
    }

    building.lift.setSize(wLift, hStage, hTotal / (maxStage - minStage + 1), minStage, maxStage);
    place(building.lift.dom, { my: "left top", at: `left bottom`, of: building.roof.dom });


    place($("#closebtn"), { my:"right top", at: "right top", of: "body" });
}

function i2s(v,d) {
    let s=`${v}`;
    while (s.length<d) s='0'+s;
    return s;
}


const maxStage = 20;
const minStage = -3;
let musicUrls = [
    "sounds/music/bach1.mp3",
    "sounds/music/jazz1.mp3",
    "sounds/music/jazz2.mp3",
    "sounds/music/jazz3.mp3",
    "sounds/music/jazz4.mp3",
    "sounds/music/last1.mp3",
    "sounds/music/last2.mp3",
    "sounds/music/last3.mp3",
    "sounds/music/last4.mp3",
    "sounds/music/last5.mp3",
    "sounds/music/moria1.mp3",
    "sounds/music/moria2.mp3",
    "sounds/music/moria3.mp3",
    "sounds/music/moria4.mp3",
    "sounds/music/moria5.mp3",
    "sounds/music/moria6.mp3",
    "sounds/music/moria7.mp3",
    "sounds/music/moria8.mp3"
]

function folllowCabin(cabin, y) {
    let y1 = $('#building').scrollTop();
    $('#building').scrollTop(y1*0.98+y*0.02);
}

async function tt(building) {
    for (; ;) {
        building.lift.moveToStage(Math.random()*maxStage, folllowCabin);
        await sleep(1000);
    }
}

function initPage() {

    let stages = {};
    let floors = {};
    for (let si = minStage; si <= maxStage; si++) {
        let floor = new Floor();
        floors[si] = floor;
        $('#building').prepend(floor.dom);
        let stage = new Stage(si);
        $('#building').prepend(stage.dom);
        stages[si] = stage;
    }

    let lift = new Lift();
    $('#building').prepend(lift.dom);
    let roof = new Roof();
    $('#building').prepend(roof.dom);

    let liftController = new LiftController(minStage, maxStage, Math.round(Math.sqrt(maxStage - minStage + 1)));
    $('#panel').append(liftController.dom)

    let userAgent = navigator.userAgent;
    let iPhoneFlag = /iPhone +OS/.test(userAgent);
    let musicPlayer = iPhoneFlag ? null : new SoundPlayer("Music");
    let soundPlayer = new SoundPlayer("Sounds",30000);
    let liftPlayer =  iPhoneFlag ? null : new SoundPlayer("Lift");
//    let liftPlayer = new SoundPlayer("Lift");


    let building = {
        dom: $('#building'),
        minStage: minStage,
        maxStage: maxStage,
        stages: stages,
        floors: floors,
        lift: lift,
        roof: roof,
        liftController: liftController,
        soundPlayer: soundPlayer
    };

    $('.loading').hide();
    $('.maincontent').show();
    $(window).resize(() => onResizeWindow(building));
    onResizeWindow(building);
    onResizeWindow(building);

    let curPlayTrack = randInt(0, musicUrls.length - 1);
    let playMusic = () => {
        if (musicPlayer) {
            curPlayTrack++;
            if (curPlayTrack >= musicUrls.length) curPlayTrack = 0;
            musicPlayer.abort();
            musicPlayer.play(musicUrls[curPlayTrack]);
        }
    }
    let setMusicVolume = () => {
        if (musicPlayer) {
            let v=$('.musicVolume').val();
            musicPlayer.setVolume(v);
        }
    }

    $('.musicVolume').on("change", setMusicVolume);
    $('.nextTrack').click(playMusic);
    setMusicVolume();

//    tt(building);

    liftController.listeners.addLisener(
        data => {
            switch (data.event) {
                case "click":
                    if (!lift.isMoving()) {
                        setTimeout(() => {
                            $.get(`lifttest${data.value}?v=${Math.random()}`, (x) => console.log(x));
                        }, 200);
                        lift.moveToStage(data.value);
                    }
                    break;
            }
        }
    );

    lift.listeners.addLisener(
        data => {
            switch (data.event) {
                case "startMoving":
                    liftController.highlightButton(data.target);
                    if (liftPlayer) liftPlayer.play(data.direction > 0 ? 'sounds/moveup.mp3' : 'sounds/movedown.mp3');
                    if (musicPlayer && !musicPlayer.isPlaying()) {
                        playMusic();
                    }
                    break;
                case "stopMoving":
                    liftController.highlightButton();
                    if (liftPlayer) liftPlayer.play('sounds/dzyn.mp3');
                    liftController.display(`${Math.round(data.target)}`);
                    break;
                case "moving":
                    folllowCabin(undefined, data.y);
                    liftController.display(`${Math.round(data.stage)} ${data.direction > 0 ? "🠕" :"🠗"}`);
                    break;
            }
        }
    )

    lift.setCabinStage(maxStage);
    $('#building').scrollTop(building.stages[maxStage].dom.position().top - building.stages[maxStage].dom.height());

    for (let i = 0; i < 20; i++) {
        chelovechekLive(building, i);
    }
/*    let chel1 = new Chelovechek(10);
    $('#building').append(chel1.dom);
    chel1.setSize(300, 400);
    place(chel1.dom, { my: "center bottom", at: "center bottom", of: door.dom });
*/
}

$(initPage);