// Matter.js Aliases
const Engine = Matter.Engine,
    Render = Matter.Render,
    Runner = Matter.Runner,
    Composite = Matter.Composite,
    Bodies = Matter.Bodies,
    Body = Matter.Body,
    Common = Matter.Common,
    Events = Matter.Events,
    Mouse = Matter.Mouse,
    MouseConstraint = Matter.MouseConstraint;

class VirtualCup {
    constructor() {
        this.engine = Engine.create({
            positionIterations: 20, // Max stability for thin walls
            velocityIterations: 20
        });
        this.world = this.engine.world;
        this.render = null;
        this.runner = null;
        this.cup = null; // Store cup body to rotate it

        // Elements
        this.startBtn = document.getElementById('startBtn');
        this.simUi = document.getElementById('simUi');

        this.startBtn.addEventListener('click', () => this.start());

        document.getElementById('resetBtn').addEventListener('click', () => {
            location.reload();
        });

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
                        alert('권한이 거부되었습니다.');
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
        this.simUi.style.display = 'block';

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

        // --- Create Cup (Thin Glass Style) ---
        const cupWidth = Math.min(width * 0.5, 300);
        const cupHeight = 350;
        const wallThickness = 10; // Thin walls requested
        const cupX = width / 2;
        const cupY = height / 2 + 50;

        this.cupDimensions = { x: cupX, y: cupY, width: cupWidth, height: cupHeight };

        // Parts positions are relative to the Container Body center
        // But Body.create with parts calculates center automatically.
        // It's safer to create parts first.

        // Glass Style
        const partOptions = {
            render: {
                fillStyle: '#d2dae2', // Light grey/blue glass
                opacity: 0.6,
                strokeStyle: '#bdc3c7',
                lineWidth: 1
            },
            friction: 0.05, // Slippery glass
            restitution: 0.2 // A bit rigid
        };

        const bottom = Bodies.rectangle(cupX, cupY + cupHeight / 2, cupWidth + wallThickness, wallThickness, partOptions);
        const leftWall = Bodies.rectangle(cupX - cupWidth / 2, cupY, wallThickness, cupHeight, partOptions);
        const rightWall = Bodies.rectangle(cupX + cupWidth / 2, cupY, wallThickness, cupHeight, partOptions);

        // Combine into one Single Body to rotate together
        this.cup = Body.create({
            parts: [bottom, leftWall, rightWall],
            isStatic: true, // It stays in place but can rotate? 
            // Static bodies in Matter.js can be roatated manually
            friction: 0.1
        });

        Composite.add(this.world, this.cup);

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
            // Repositioning cup logic omitted for simplicity
        });
    }

    initSensors() {
        // 1. Device Orientation (Mobile) -> Rotate Cup
        window.addEventListener('deviceorientation', (event) => {
            if (event.gamma === null) return;

            // Gamma is left/right tilt (-90 to 90)
            // Convert to radians directly
            const tiltAngle = (event.gamma) * (Math.PI / 180);

            // Limit tilt to prevent flipping completely? No, let user flip it!
            // But map it nicely.

            if (this.cup) {
                // Set rotation directly
                Body.setAngle(this.cup, tiltAngle);
            }
        });

        // 2. Mouse Drag to Rotate (PC)
        let isDragging = false;
        let startX = 0;

        document.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.closest('.toolbar')) return;
            isDragging = true;
            startX = e.clientX;
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging || !this.cup) return;

            const currentX = e.clientX;
            const deltaX = currentX - startX;

            // Drag distance controls angle
            // 200px drag = 45 degrees (PI/4)
            const angle = (deltaX / 300) * (Math.PI / 2);

            Body.setAngle(this.cup, angle);
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            // Optional: Auto-reset cup to upright?
            // Body.setAngle(this.cup, 0); 

            // Or simple animation back to 0
            const resetInterval = setInterval(() => {
                if (isDragging) { clearInterval(resetInterval); return; }

                if (Math.abs(this.cup.angle) < 0.05) {
                    Body.setAngle(this.cup, 0);
                    clearInterval(resetInterval);
                } else {
                    Body.setAngle(this.cup, this.cup.angle * 0.9); // Ease out
                }
            }, 16);
        });
    }

    // --- Dynamic Item Spawner ---
    addItems(type, count = 20) {
        // Drop from top center, independent of cup rotation
        const spawnX = window.innerWidth / 2;
        const spawnY = this.cupDimensions.y - this.cupDimensions.height - 50;
        const spread = this.cupDimensions.width / 2;

        const newBodies = [];

        for (let i = 0; i < count; i++) {
            const x = spawnX + (Math.random() - 0.5) * spread;
            const y = spawnY - Math.random() * 100;

            let body;
            // ... (Same item types as before) ...
            if (type === 'water') {
                body = Bodies.circle(x, y, Common.random(4, 7), {
                    friction: 0.001, restitution: 0.1, frictionAir: 0.01, render: { fillStyle: '#3498db' }
                });
            } else if (type === 'wood') {
                body = Bodies.rectangle(x, y, Common.random(15, 25), Common.random(15, 25), {
                    density: 0.0005, frictionAir: 0.02, restitution: 0.2, render: { fillStyle: '#8d6e63' }
                });
            } else if (type === 'ball') {
                body = Bodies.circle(x, y, Common.random(10, 15), {
                    restitution: 0.9, render: { fillStyle: '#e67e22' }
                });
            } else if (type === 'ice') {
                body = Bodies.rectangle(x, y, Common.random(12, 18), Common.random(12, 18), {
                    friction: 0.0, render: { fillStyle: '#a29bfe', opacity: 0.6 }
                });
            } else if (type === 'popcorn') {
                body = Bodies.polygon(x, y, Math.floor(Math.random() * 4) + 3, Common.random(8, 12), {
                    restitution: 0.5, density: 0.0001, render: { fillStyle: '#fdcb6e' }
                });
            }
            if (body) newBodies.push(body);
        }
        Composite.add(this.world, newBodies);
    }
}

const app = new VirtualCup();
window.app = app;
