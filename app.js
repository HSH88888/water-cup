// Matter.js Aliases
const Engine = Matter.Engine,
    Render = Matter.Render,
    Runner = Matter.Runner,
    Composite = Matter.Composite,
    Bodies = Matter.Bodies,
    Common = Matter.Common,
    Events = Matter.Events;

class VirtualCup {
    constructor() {
        this.engine = Engine.create();
        this.world = this.engine.world;
        this.render = null;
        this.runner = null;
        this.isSensorActive = false;

        // Init Button
        this.startBtn = document.getElementById('startBtn');
        this.startBtn.addEventListener('click', () => this.start());

        document.getElementById('resetBtn').addEventListener('click', () => {
            location.reload();
        });
    }

    start() {
        // Request Permission (iOS 13+)
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
            // Non-iOS or older devices
            this.initPhysics();
            this.initSensors();
        }
    }

    initPhysics() {
        document.body.classList.add('running');

        // 1. Setup Render
        this.render = Render.create({
            element: document.body,
            engine: this.engine,
            options: {
                width: window.innerWidth,
                height: window.innerHeight,
                wireframes: false, // Show colors
                background: 'transparent'
            }
        });

        const width = window.innerWidth;
        const height = window.innerHeight;

        // 2. Create Cup (U-shape)
        // Center of screen
        const cupWidth = Math.min(width * 0.5, 250); // Relative width, max 250px
        const cupHeight = 350;
        const wallThickness = 15;
        const cupX = width / 2;
        const cupY = height / 2 + 50; // Slightly lower than center

        const cupOptions = {
            isStatic: true,
            render: { fillStyle: '#ffffff', opacity: 0.9 },
            friction: 0.1
        };

        // Cup Parts calculated relative to center
        // Bottom
        const bottom = Bodies.rectangle(cupX, cupY + cupHeight / 2, cupWidth, wallThickness, cupOptions);
        // Left Wall
        const leftWall = Bodies.rectangle(cupX - cupWidth / 2 + wallThickness / 2, cupY, wallThickness, cupHeight, cupOptions);
        // Right Wall
        const rightWall = Bodies.rectangle(cupX + cupWidth / 2 - wallThickness / 2, cupY, wallThickness, cupHeight, cupOptions);

        Composite.add(this.world, [bottom, leftWall, rightWall]);

        // 3. Add 'Water' Particles INSIDE the cup
        const particleOptions = {
            friction: 0.001, // Very slippery like water
            restitution: 0.1, // Not bouncy
            frictionAir: 0.02, // Some air resistance
            density: 1.0,  // Standard density
            render: { fillStyle: '#3498db' }
        };

        const particles = [];
        const particleRadius = 5;
        const particleCount = 200; // Enough to fill half cup

        // Fill grid inside cup
        const startX = cupX - cupWidth / 2 + wallThickness * 2;
        // Start filling from bottom up
        let currentX = startX;
        let currentY = cupY + cupHeight / 2 - wallThickness - 20;

        for (let i = 0; i < particleCount; i++) {
            particles.push(Bodies.circle(currentX + (Math.random() * 4 - 2), currentY, particleRadius, particleOptions));

            currentX += particleRadius * 2.2;
            // Next row if full
            if (currentX > cupX + cupWidth / 2 - wallThickness * 2) {
                currentX = startX;
                currentY -= particleRadius * 2.2;
            }
        }

        Composite.add(this.world, particles);

        // 4. Run
        Render.run(this.render);
        this.runner = Runner.create();
        Runner.run(this.runner, this.engine);

        // 5. Add Mouse Interaction
        const Mouse = Matter.Mouse,
            MouseConstraint = Matter.MouseConstraint;

        const mouse = Mouse.create(this.render.canvas);
        const mouseConstraint = MouseConstraint.create(this.engine, {
            mouse: mouse,
            constraint: {
                stiffness: 0.2,
                render: {
                    visible: false
                }
            }
        });

        Composite.add(this.world, mouseConstraint);
        this.render.mouse = mouse; // Sync render with mouse

        // Resize Handler
        window.addEventListener('resize', () => {
            this.render.canvas.width = window.innerWidth;
            this.render.canvas.height = window.innerHeight;
            // Note: Body positions are static, so they won't re-center automatically on resize.
            // Reload page recommended for big resize.
        });
    }

    initSensors() {
        window.addEventListener('deviceorientation', (event) => {
            // Gamma: Left/Right tilt (-90 to 90) -> Gravity X
            // Beta: Front/Back tilt (-180 to 180) -> Gravity Y

            const gravity = this.engine.world.gravity;

            if (event.gamma !== null) {
                // Adjust sensitivity
                // When phone is upright (Beta ~90), Gravity Y = 1
                // When phone tilted left (Gamma < 0), Gravity X < 0

                // Clamp values to realistic gravity scale
                const x = Common.clamp(event.gamma / 45, -1.5, 1.5);
                const y = Common.clamp(event.beta / 45, -1.5, 1.5);

                // Smooth update if needed, but direct is more responsive
                gravity.x = x;
                gravity.y = y;
            }
        });
    }
}

// Start App
const app = new VirtualCup();
