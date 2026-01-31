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
        this.debugInfo = document.getElementById('debugInfo'); // Debug Panel

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
        if (this.debugInfo) this.debugInfo.style.display = 'block'; // Show Debug

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

        // --- Debug Loop ---
        // Update debug text every 500ms to avoid DOM thrashing or every tick?
        // Every tick is fine for simple text.
        Events.on(this.runner, 'afterTick', () => {
            if (!this.debugInfo) return;

            // FPS
            const fps = this.runner.fps || 60;
            // Objects: Total bodies - Cup(1) - MouseConstraint(1) - Invisible walls(0)?
            // Recursive count
            const allBodies = Composite.allBodies(this.world);
            const bodyCount = allBodies.length;

            // Gravity Tilt
            const gx = this.engine.gravity.x.toFixed(2);
            const gy = this.engine.gravity.y.toFixed(2);

            this.debugInfo.innerHTML = `
                Objects: ${bodyCount}<br>
                FPS: ${Math.round(fps)}<br>
                Tilt: X ${gx}, Y ${gy}
            `;
        });
    }

    initSensors() {
        window.addEventListener('devicemotion', (event) => {
            const acc = event.accelerationIncludingGravity;
            if (!acc) return;

            const rawX = -(acc.x || 0) / 9.8;
            const rawY = (acc.y || 0) / 9.8;

            let orientation = 0;
            if (window.screen && window.screen.orientation) {
                orientation = window.screen.orientation.angle;
            } else if (typeof window.orientation !== 'undefined') {
                orientation = window.orientation;
            }

            const rad = orientation * (Math.PI / 180);

            const finalX = rawX * Math.cos(rad) + rawY * Math.sin(rad);
            const finalY = -rawX * Math.sin(rad) + rawY * Math.cos(rad);

            this.engine.gravity.x = finalX;
            this.engine.gravity.y = finalY;

            if (this.cup) {
                Body.setAngle(this.cup, 0);
            }
        });

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
