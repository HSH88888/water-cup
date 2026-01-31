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

        // 2. Create Bounds (Cup Walls)
        const width = window.innerWidth;
        const height = window.innerHeight;
        const wallOptions = {
            isStatic: true,
            render: { fillStyle: '#ffffff', opacity: 0.8 },
            friction: 0.5
        };

        // Screen is the cup? Or specific cup shape? 
        // Let's make the SCREEN boundaries the cup for simplicity first, 
        // but open top so water can fly out if shaken hard.

        // Floor
        const floor = Bodies.rectangle(width / 2, height + 50, width, 100, wallOptions);
        // Left Wall
        const leftWall = Bodies.rectangle(-50, height / 2, 100, height * 2, wallOptions);
        // Right Wall
        const rightWall = Bodies.rectangle(width + 50, height / 2, 100, height * 2, wallOptions);

        Composite.add(this.world, [floor, leftWall, rightWall]);

        // 3. Add 'Water' Particles
        // Create 300 little blue circles
        const particleOptions = {
            friction: 0.05,
            restitution: 0.5, // Bounciness
            render: { fillStyle: '#3498db' }
        };

        const particles = [];
        for (let i = 0; i < 400; i++) {
            const x = Common.random(50, width - 50);
            const y = Common.random(0, height / 2);
            particles.push(Bodies.circle(x, y, Common.random(5, 10), particleOptions));
        }

        // Add Stack instead for cleaner drop?
        // Let's just drop them randomly
        Composite.add(this.world, particles);

        // 4. Run
        Render.run(this.render);
        this.runner = Runner.create();
        Runner.run(this.runner, this.engine);

        // Resize Handler
        window.addEventListener('resize', () => {
            this.render.canvas.width = window.innerWidth;
            this.render.canvas.height = window.innerHeight;
        });
    }

    initSensors() {
        window.addEventListener('deviceorientation', (event) => {
            // Gamma: Left/Right tilt (-90 to 90) -> Controls Gravity X
            // Beta: Front/Back tilt (-180 to 180) -> Controls Gravity Y

            // Adjust gravity based on tilt
            // Default gravity is y: 1

            const gravity = this.engine.world.gravity;

            if (event.gamma !== null) {
                // Determine gravity vector
                // Simple version:
                // Tilt Right (Gamma > 0) -> Gravity X positive
                // Tilt Left (Gamma < 0) -> Gravity X negative
                // Upside down (Beta < -90 or > 90) -> Gravity Y negative

                const x = Common.clamp(event.gamma / 45, -1, 1);
                const y = Common.clamp(event.beta / 45, -1, 1);

                gravity.x = x;
                gravity.y = y;
            }
        });

        // Fallback for Desktop testing (Mouse interaction)
        // Add MouseConstraint if needed, but Gravity is key here.
    }
}

// Start App
const app = new VirtualCup();
