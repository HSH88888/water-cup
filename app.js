// Matter.js Aliases
const Engine = Matter.Engine,
    Render = Matter.Render,
    Runner = Matter.Runner,
    Composite = Matter.Composite,
    Bodies = Matter.Bodies,
    Common = Matter.Common,
    Events = Matter.Events,
    Mouse = Matter.Mouse,
    MouseConstraint = Matter.MouseConstraint;

class VirtualCup {
    constructor() {
        this.engine = Engine.create();
        this.world = this.engine.world;
        this.render = null;
        this.runner = null;

        // Elements
        this.startBtn = document.getElementById('startBtn');
        this.simUi = document.getElementById('simUi');

        this.startBtn.addEventListener('click', () => this.start());

        document.getElementById('resetBtn').addEventListener('click', () => {
            location.reload();
        });

        // Define Cup Dimensions explicitly for reuse
        this.cupDimensions = {};
    }

    start() {
        if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
            DeviceMotionEvent.requestPermission()
                .then(response => {
                    if (response === 'granted') {
                        this.initPhysics();
                        this.initSensors();
                    } else {
                        alert('센서 권한이 필요합니다.');
                    }
                })
                .catch(console.error);
        } else {
            this.initPhysics();
            this.initSensors();
        }
    }

    initPhysics() {
        document.body.classList.add('running');
        this.simUi.style.display = 'block'; // Show Toolbar

        this.render = Render.create({
            element: document.body,
            engine: this.engine,
            options: {
                width: window.innerWidth,
                height: window.innerHeight,
                wireframes: false,
                background: 'transparent'
            }
        });

        const width = window.innerWidth;
        const height = window.innerHeight;

        // --- Create Cup ---
        const cupWidth = Math.min(width * 0.6, 300);
        const cupHeight = 400;
        const wallThickness = 20;
        const cupX = width / 2;
        const cupY = height / 2 + 50;

        this.cupDimensions = { x: cupX, y: cupY, width: cupWidth, height: cupHeight };

        const cupOptions = {
            isStatic: true,
            render: { fillStyle: '#ffffff', opacity: 0.8 },
            friction: 0.1
        };

        const bottom = Bodies.rectangle(cupX, cupY + cupHeight / 2, cupWidth, wallThickness, cupOptions);
        const leftWall = Bodies.rectangle(cupX - cupWidth / 2 + wallThickness / 2, cupY, wallThickness, cupHeight, cupOptions);
        const rightWall = Bodies.rectangle(cupX + cupWidth / 2 - wallThickness / 2, cupY, wallThickness, cupHeight, cupOptions);

        Composite.add(this.world, [bottom, leftWall, rightWall]);

        // Add Initial Water
        this.addItems('water', 50);

        // --- Run ---
        Render.run(this.render);
        this.runner = Runner.create();
        Runner.run(this.runner, this.engine);

        // --- Interaction ---
        const mouse = Mouse.create(this.render.canvas);
        const mouseConstraint = MouseConstraint.create(this.engine, {
            mouse: mouse,
            constraint: { stiffness: 0.2, render: { visible: false } }
        });
        Composite.add(this.world, mouseConstraint);
        this.render.mouse = mouse;

        window.addEventListener('resize', () => {
            this.render.canvas.width = window.innerWidth;
            this.render.canvas.height = window.innerHeight;
        });
    }

    initSensors() {
        window.addEventListener('deviceorientation', (event) => {
            if (event.gamma === null) return;
            const gravity = this.engine.world.gravity;
            const x = Common.clamp(event.gamma / 45, -2, 2);
            const y = Common.clamp(event.beta / 45, -2, 2);
            gravity.x = x;
            gravity.y = y;
        });
    }

    // --- Dynamic Item Spawner ---
    addItems(type, count = 20) {
        // Spawn Location: Above the cup
        const spawnX = this.cupDimensions.x;
        const spawnY = this.cupDimensions.y - this.cupDimensions.height / 2;
        const spread = this.cupDimensions.width / 2;

        const newBodies = [];

        for (let i = 0; i < count; i++) {
            const x = spawnX + (Math.random() - 0.5) * spread;
            const y = spawnY - Math.random() * 200; // Falling from sky

            let body;

            if (type === 'water') {
                body = Bodies.circle(x, y, Common.random(4, 7), {
                    friction: 0.001,
                    restitution: 0.1,
                    frictionAir: 0.01, // fast
                    render: { fillStyle: '#3498db' }
                });
            }
            else if (type === 'wood') {
                body = Bodies.rectangle(x, y, Common.random(15, 25), Common.random(15, 25), {
                    density: 0.0005, // Floats on water (if standard density is used, lighter)
                    frictionAir: 0.02,
                    restitution: 0.2,
                    render: { fillStyle: '#8e44ad' } // actually wood color #8d6e63
                });
                body.render.fillStyle = '#8d6e63';
            }
            else if (type === 'ball') {
                body = Bodies.circle(x, y, Common.random(10, 15), {
                    restitution: 0.9, // Very bouncy
                    render: { fillStyle: '#e67e22' }
                });
            }
            else if (type === 'ice') {
                body = Bodies.rectangle(x, y, Common.random(12, 18), Common.random(12, 18), {
                    friction: 0.0, // Slippery
                    render: { fillStyle: '#a29bfe', opacity: 0.6 }
                });
            }
            else if (type === 'popcorn') {
                // Random polygon
                body = Bodies.polygon(x, y, Math.floor(Math.random() * 4) + 3, Common.random(8, 12), {
                    restitution: 0.5,
                    density: 0.0001, // Very light
                    render: { fillStyle: '#fdcb6e' }
                });
            }

            if (body) newBodies.push(body);
        }

        Composite.add(this.world, newBodies);
    }
}

const app = new VirtualCup();
window.app = app; // Expose to global for HTML onclick
