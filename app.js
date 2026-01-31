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
            positionIterations: 20,
            velocityIterations: 20
        });

        // Default Gravity
        this.engine.gravity.x = 0;
        this.engine.gravity.y = 1;

        this.world = this.engine.world;
        this.render = null;
        this.runner = null;
        this.cup = null;

        // Detect Mobile
        this.isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

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

        // Create Cup
        const cupWidth = Math.min(width * 0.5, 300);
        const cupHeight = 350;
        const wallThickness = 10;
        const cupX = width / 2;
        const cupY = height / 2 + 50;

        this.cupDimensions = { x: cupX, y: cupY, width: cupWidth, height: cupHeight };

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

        this.addItems('water', 50);

        Render.run(this.render);
        this.runner = Runner.create();
        Runner.run(this.runner, this.engine);

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
            // Note: Canvas resize doesn't update body bounds automatically, 
            // but keeps simulation running.
        });
    }

    initSensors() {
        // Mobile Gravity
        window.addEventListener('devicemotion', (event) => {
            const acc = event.accelerationIncludingGravity;
            if (!acc) return;

            // 1. Raw Device Vectors (Normalized)
            // Android/iOS Standard:
            // x+ is Device Right
            // y+ is Device Top
            // z+ is Device Screen Face
            // Gravity on Earth is DOWN.
            // Resting Upright: acc.y ~ +9.8 (Reaction Up) OR -9.8 (Gravity Down)?
            // Consistency Check: Upright phone usually reports y ~ -9.8 (Gravity vector) on some, +9.8 on others.
            // My previous test `gy = acc.y` worked for Upright. That implies `acc.y` was +9.8 (Reaction).
            // So we assume: acc points UP (Reaction).
            // We want Gravity Down. So +Y Reaction -> +Y Gravity (Screen Bottom).

            const rawX = -(acc.x || 0) / 9.8;
            const rawY = (acc.y || 0) / 9.8;

            // 2. Compensate for Screen Orientation
            // If screen rotates 180 degrees, Screen Top is Device Bottom.
            // window.orientation is deprecated but useful. screen.orientation.angle is modern.
            let orientation = 0;
            if (window.screen && window.screen.orientation) {
                orientation = window.screen.orientation.angle;
            } else if (typeof window.orientation !== 'undefined') {
                orientation = window.orientation;
            }

            // Convert deg to rad
            const rad = orientation * (Math.PI / 180);

            // Rotate the gravity vector to match Screen Coordinates
            // If orientation is 90 (Landscape Left), Screen X is Device Y?
            // Rotation Matrix for 2D Vector:
            // x' = x cos(t) - y sin(t)
            // y' = x sin(t) + y cos(t)
            // Note: Orientation angle sign conventions vary.
            // Usually 90 means rotated Clockwise.
            // So we need to rotate Vector Counter-Clockwise to compensate?
            // Actually, if Device is rotated 90 CW, "Down" is now "Left" relative to device.
            // Screen handles the graphic rotation.
            // We need to rotate the Gravity Vector so it stays "Down" relative to World.

            // Try standard rotation:
            // Portrait (0): x=gx, y=gy
            // Upside Down (180): x=-gx, y=-gy.
            //   If rawY was 1 (Upright), now rawY is -1 (Upside down).
            //   We want Result Y to be 1 (Screen Bottom is Earth).
            //   Wait, Screen Bottom is Sky now.
            //   Earth is Screen Top (-1).
            //   So if rawY is -1, Result is -1. 
            //   If we just pass rawY (-1), we get -1. Correct.
            //   So 180 deg rotation needs NO change?
            //   Ah, if the SCREEN physically rotated 180 pixels, then coordinates flipped?
            //   Usually mobile browser rotates content.
            //   So coordinate (0,0) is always Top-Left visually.

            // Let's rely on the rotation formula.
            // If orientation is 180:
            // Real rotation.
            // We need to apply it to vector.
            // 180 deg: x' = -x, y' = -y.
            // If rawY was -1, y' = 1.
            // Result 1 (Down).
            // This means gravity points to Screen Bottom.
            // But Screen Bottom is Sky.
            // So water falls to Sky. (WRONG).

            // Hmm. Let's look at `acc` properties. `acc` frame is DEVICE frame.
            // If I hold phone Upside Down:
            // Device Top is Down.
            // `acc.y` ~ -9.8 (Reaction Up relative to device? No, Reaction is Up world, which is Device Top/Device Y+).
            // So `acc.y` ~ +9.8.
            // rawY ~ +1.
            // If I don't rotate: `gy = 1`. Water falls to Screen Bottom (Sky). WRONG.
            // If I rotate 180: `gy = -1`. Water falls to Screen Top (Earth). CORRECT.

            // So yes, we MUST rotate the vector by the orientation angle.
            // But in which direction? 
            // If Angle is 180, we want to negate. cos(180) = -1. 
            // So standard rotation matrix seems correct.
            // Invert angle sign? 
            // Orientation 90 (Client rotated CW).
            // We need to rotate vector CW to match new X/Y axes?
            // Let's try `rad`.

            // If Screen rotates CW (90):
            // Screen X+ is Device Y+.
            // Screen Y+ is Device -X.

            // Formula for rotating AXES CW:
            // x' = x cos(t) + y sin(t)
            // y' = -x sin(t) + y cos(t)

            // Let's test Portrait (0):
            // x' = x, y' = y. OK.

            // Test 180:
            // x' = -x, y' = -y.
            // rawY (+1) -> -1. Water to Top (Earth). Correct.

            // Test 90:
            // x' = y (Screen X is Device Y).
            // y' = -x (Screen Y is Device -X).
            // Device Landscape (Left):
            // Device Right (X+) is Up. Device Top (Y+) is Left.
            // Gravity (Down) is Device Left (-X+?).
            // Reaction (Up) is Device Right (X+). `acc.x` ~ +9.8.
            // `rawX` ~ -1.
            // `rawY` ~ 0.
            // calc: y' = -(-1) = 1.
            // Result: Gravity Y = 1 (Screen Bottom).
            // Landscape mode, Screen Bottom is Earth? Yes.
            // Correct.

            const finalX = rawX * Math.cos(rad) + rawY * Math.sin(rad);
            const finalY = -rawX * Math.sin(rad) + rawY * Math.cos(rad);

            this.engine.gravity.x = finalX;
            this.engine.gravity.y = finalY;

            if (this.cup) {
                Body.setAngle(this.cup, 0);
            }
        });

        // PC Only
        if (!this.isMobile) {
            let isDragging = false;
            let startX = 0;

            document.addEventListener('mousedown', (e) => {
                if (e.target.tagName === 'BUTTON' || e.target.closest('.toolbar')) return;
                isDragging = true;
                startX = e.clientX;
            });

            document.addEventListener('mousemove', (e) => {
                if (!isDragging || !this.cup) return;
                const deltaX = e.clientX - startX;
                Body.setAngle(this.cup, (deltaX / 300) * (Math.PI / 2));
            });

            document.addEventListener('mouseup', () => {
                isDragging = false;
                const resetInterval = setInterval(() => {
                    if (isDragging) { clearInterval(resetInterval); return; }
                    if (Math.abs(this.cup.angle) < 0.05) {
                        Body.setAngle(this.cup, 0);
                        clearInterval(resetInterval);
                    } else {
                        Body.setAngle(this.cup, this.cup.angle * 0.9);
                    }
                }, 16);
            });
        }
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

            // Define item types...
            const commonOps = { restitution: 0.2, friction: 0.1 };
            if (type === 'water') {
                body = Bodies.circle(x, y, Common.random(4, 7), {
                    friction: 0.001, restitution: 0.1, frictionAir: 0.01, render: { fillStyle: '#3498db' }
                });
            } else if (type === 'wood') {
                body = Bodies.rectangle(x, y, Common.random(15, 25), Common.random(15, 25), {
                    density: 0.0005, frictionAir: 0.02, render: { fillStyle: '#8d6e63' }
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
