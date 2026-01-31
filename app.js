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

        // Default Gravity
        this.engine.gravity.x = 0;
        this.engine.gravity.y = 1;

        this.world = this.engine.world;
        this.render = null;
        this.runner = null;
        this.cup = null;

        // Flag to prevent mouse interference on mobile
        this.sensorActive = false;

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
        const wallThickness = 10;
        const cupX = width / 2;
        const cupY = height / 2 + 50;

        this.cupDimensions = { x: cupX, y: cupY, width: cupWidth, height: cupHeight };

        // Glass Style
        const partOptions = {
            render: {
                fillStyle: '#d2dae2',
                opacity: 0.6,
                strokeStyle: '#bdc3c7',
                lineWidth: 1
            },
            friction: 0.05,
            restitution: 0.2
        };

        const bottom = Bodies.rectangle(cupX, cupY + cupHeight / 2, cupWidth + wallThickness, wallThickness, partOptions);
        const leftWall = Bodies.rectangle(cupX - cupWidth / 2, cupY, wallThickness, cupHeight, partOptions);
        const rightWall = Bodies.rectangle(cupX + cupWidth / 2, cupY, wallThickness, cupHeight, partOptions);

        this.cup = Body.create({
            parts: [bottom, leftWall, rightWall],
            isStatic: true,
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
        });
    }

    initSensors() {
        // 1. Device Orientation (Mobile) -> Change Gravity Logic
        window.addEventListener('deviceorientation', (event) => {
            if (event.gamma === null) return;

            this.sensorActive = true;

            // Normalize Rotation: Cup stays fixed, Gravity changes direction.
            // When phone tilts Right (gamma +), Gravity should pull Right (x +).

            const theta = event.gamma * (Math.PI / 180);

            // Limit gravity Angle to avoid weird upside-down physics if flipped too far
            // But full 360 is fun. Let's clamp to -90 ~ 90 for stability
            let safeTheta = theta;
            if (safeTheta > Math.PI / 2) safeTheta = Math.PI / 2;
            if (safeTheta < -Math.PI / 2) safeTheta = -Math.PI / 2;

            // Apply Gravity Vector
            // x = sin(theta), y = cos(theta)
            // e.g. 0 deg -> x=0, y=1 (Down)
            // 90 deg -> x=1, y=0 (Right)
            this.engine.gravity.x = Math.sin(safeTheta);
            this.engine.gravity.y = Math.cos(safeTheta);

            // Ensure Cup is Fixed Upright (0 degrees)
            if (this.cup) {
                Body.setAngle(this.cup, 0);
            }
        });

        // 2. Mouse Drag (PC Only) -> Rotate Cup
        let isDragging = false;
        let startX = 0;

        document.addEventListener('mousedown', (e) => {
            if (this.sensorActive) return; // Ignore on mobile

            if (e.target.tagName === 'BUTTON' || e.target.closest('.toolbar')) return;
            isDragging = true;
            startX = e.clientX;
        });

        document.addEventListener('mousemove', (e) => {
            if (this.sensorActive || !isDragging || !this.cup) return;

            const currentX = e.clientX;
            const deltaX = currentX - startX;

            // On PC, we still rotate the Cup because monitor doesn't tilt.
            const angle = (deltaX / 300) * (Math.PI / 2);

            Body.setAngle(this.cup, angle);
        });

        document.addEventListener('mouseup', () => {
            if (this.sensorActive) return;
            isDragging = false;

            const resetInterval = setInterval(() => {
                if (isDragging || this.sensorActive) { clearInterval(resetInterval); return; }

                if (Math.abs(this.cup.angle) < 0.05) {
                    Body.setAngle(this.cup, 0);
                    clearInterval(resetInterval);
                } else {
                    Body.setAngle(this.cup, this.cup.angle * 0.9);
                }
            }, 16);
        });
    }

    addItems(type, count = 20) {
        const spawnX = window.innerWidth / 2;
        const spawnY = this.cupDimensions.y - this.cupDimensions.height - 50;
        const spread = this.cupDimensions.width / 2;

        const newBodies = [];

        for (let i = 0; i < count; i++) {
            const x = spawnX + (Math.random() - 0.5) * spread;
            const y = spawnY - Math.random() * 100;

            let body;
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
