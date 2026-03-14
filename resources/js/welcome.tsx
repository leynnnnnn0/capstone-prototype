import { useState, useEffect, useRef, ReactNode } from 'react';
import LOGO from '../../images/whiteLogo.png';
// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
    name: string;
    icon: string;
    desc: string;
}

interface Step {
    num: string;
    title: string;
    desc: string;
}

interface Role {
    role: string;
    emoji: string;
    accentClass: string;
    checkClass: string;
    features: string[];
}

interface FadeInProps {
    children: ReactNode;
    delay?: number;
    className?: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const NAV_LINKS: string[] = ['Features', 'Products', 'How It Works', 'Roles'];

const PRODUCTS: Product[] = [
    {
        name: 'Sliding Windows',
        icon: '⬜',
        desc: 'Visualize aluminum sliding windows on your walls before installation.',
    },
    {
        name: 'Glass Doors',
        icon: '🚪',
        desc: 'Full-glass and framed door overlays with real-time AR preview.',
    },
    {
        name: 'Screen Doors',
        icon: '🔲',
        desc: 'See exactly how screen doors fit your entrance in augmented reality.',
    },
    {
        name: 'Shop Fronts',
        icon: '🏪',
        desc: 'Preview commercial glass shopfronts scaled to your actual facade.',
    },
    {
        name: 'ACP Cabinets',
        icon: '🗄️',
        desc: 'Aluminum composite panel cabinet visualization for any space.',
    },
    {
        name: 'Kitchen Cabinets',
        icon: '🍳',
        desc: 'L-shape and U-shape kitchen cabinet layouts in your actual kitchen.',
    },
];

const STEPS: Step[] = [
    {
        num: '01',
        title: 'Open the Website',
        desc: "No app download needed. Open on any Android phone using Chrome — that's it.",
    },
    {
        num: '02',
        title: 'Point at the Wall',
        desc: 'Grant camera access and point your phone at the window area. ARCore detects the surface automatically.',
    },
    {
        num: '03',
        title: 'Tap to Measure',
        desc: 'Tap two points on screen to mark width and height. Real-world dimensions are calculated instantly.',
    },
    {
        num: '04',
        title: 'See It in AR',
        desc: 'Your chosen product appears on your wall at exact scale. Switch styles and colors in real time.',
    },
    {
        num: '05',
        title: 'Get Your Quote',
        desc: 'Measurements auto-fill a price estimate. Review it and book an on-site appointment in one tap.',
    },
];

const ROLES: Role[] = [
    {
        role: 'Customer',
        emoji: '👤',
        accentClass: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
        checkClass: 'bg-blue-500',
        features: [
            'AR camera measurement — no tape measure needed',
            'Visualize windows, doors & cabinets on your actual wall',
            'Instant auto-generated price quotation',
            'Browse full product catalog',
            'Online appointment booking',
            'Download quotation as PDF',
            'SMS & email confirmation',
        ],
    },
    {
        role: 'Staff',
        emoji: '👨‍💼',
        accentClass: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
        checkClass: 'bg-emerald-500',
        features: [
            'Manage & confirm appointments',
            'Review and finalize quotations',
            'Full customer records & history',
            'Update product catalog & pricing',
            'Inventory monitoring',
            'Low stock alerts',
            'Log completed jobs & payments',
        ],
    },
    {
        role: 'Installer',
        emoji: '🔧',
        accentClass: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
        checkClass: 'bg-amber-500',
        features: [
            'View assigned jobs & schedules',
            'Access customer measurements & specs',
            'Update job status in real time',
            'Daily & weekly installation calendar',
            'Submit job completion reports',
        ],
    },
    {
        role: 'Owner',
        emoji: '👑',
        accentClass: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
        checkClass: 'bg-purple-500',
        features: [
            'KPI dashboard — revenue, bookings, conversion',
            'Monthly & yearly sales reports',
            'Inventory & material consumption reports',
            'Staff performance tracking',
            'Quotation-to-job conversion rate',
            'Full system control',
            'Appointment calendar overview',
        ],
    },
];

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useInView(
    threshold = 0.15,
): [React.RefObject<HTMLDivElement>, boolean] {
    const ref = useRef<HTMLDivElement>(null);
    const [inView, setInView] = useState<boolean>(false);

    useEffect(() => {
        const obs = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) setInView(true);
            },
            { threshold },
        );
        if (ref.current) obs.observe(ref.current);
        return () => obs.disconnect();
    }, [threshold]);

    return [ref, inView];
}

// ─── Components ───────────────────────────────────────────────────────────────

function FadeIn({ children, delay = 0, className = '' }: FadeInProps) {
    const [ref, inView] = useInView();
    return (
        <div
            ref={ref}
            className={className}
            style={{
                opacity: inView ? 1 : 0,
                transform: inView ? 'translateY(0px)' : 'translateY(24px)',
                transition: `opacity 0.65s ease ${delay}s, transform 0.65s ease ${delay}s`,
            }}
        >
            {children}
        </div>
    );
}

function ARPhoneMockup() {
    return (
        <div className="relative flex items-center justify-center">
            {/* Glow */}
            <div className="absolute h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />

            {/* Phone */}
            <div className="relative h-[420px] w-52 animate-[float_4s_ease-in-out_infinite] overflow-hidden rounded-[2.5rem] border border-white/10 bg-slate-900 shadow-2xl shadow-black/60 sm:h-[448px] sm:w-56">
                {/* Notch */}
                <div className="absolute top-3 left-1/2 z-10 h-5 w-20 -translate-x-1/2 rounded-xl bg-slate-950" />

                {/* Screen content */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800">
                    {/* Grid lines simulating room */}
                    <div
                        className="absolute inset-0 opacity-10"
                        style={{
                            backgroundImage:
                                'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
                            backgroundSize: '40px 40px',
                        }}
                    />

                    {/* AR Window overlay */}
                    <div className="absolute top-[28%] right-[15%] left-[15%] h-[38%] rounded border-2 border-blue-400/80 bg-blue-400/8">
                        {/* Panes */}
                        <div className="absolute inset-2 grid grid-cols-2 gap-1">
                            {[0, 1, 2, 3].map((i) => (
                                <div
                                    key={i}
                                    className="rounded border border-blue-400/20 bg-blue-300/10"
                                />
                            ))}
                        </div>
                        {/* Width label */}
                        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 rounded bg-blue-500 px-2 py-0.5 text-[9px] font-bold whitespace-nowrap text-white">
                            1.2m wide
                        </div>
                        {/* Height label */}
                        <div className="absolute top-1/2 -right-8 -translate-y-1/2 rounded bg-blue-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                            0.9m
                        </div>
                    </div>

                    {/* Corner tap dots */}
                    {(
                        [
                            [15, 28],
                            [85, 28],
                            [15, 66],
                            [85, 66],
                        ] as [number, number][]
                    ).map(([x, y], i) => (
                        <div
                            key={i}
                            className="absolute h-2.5 w-2.5 rounded-full border-2 border-blue-400 bg-blue-400/30"
                            style={{
                                left: `${x}%`,
                                top: `${y}%`,
                                transform: 'translate(-50%,-50%)',
                            }}
                        />
                    ))}

                    {/* Scan line */}
                    <div
                        className="absolute right-0 left-0 h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent"
                        style={{ animation: 'scan 2.5s ease-in-out infinite' }}
                    />
                </div>

                {/* Bottom UI */}
                <div className="absolute right-0 bottom-0 left-0 bg-slate-950/95 px-4 pt-3 pb-7 backdrop-blur">
                    <p className="mb-2 text-[10px] tracking-widest text-slate-400 uppercase">
                        Detected: Sliding Window
                    </p>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-slate-300">
                                Est. Price
                            </p>
                            <p className="text-lg font-bold text-blue-400">
                                ₱12,500
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Floating card — measurement */}
            <div className="absolute top-4 -right-2 w-32 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 backdrop-blur-xl sm:-right-8">
                <p className="mb-1 text-[9px] font-semibold tracking-widest text-slate-400 uppercase">
                    Measurement
                </p>
                <p className="text-sm font-bold text-white">1.2m × 0.9m</p>
                <p className="mt-0.5 text-[10px] text-emerald-400">
                    ✓ Auto-detected
                </p>
            </div>

            {/* Floating card — status */}
            <div className="absolute bottom-16 -left-2 w-32 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 backdrop-blur-xl sm:-left-10">
                <p className="mb-1 text-[9px] font-semibold tracking-widest text-slate-400 uppercase">
                    Status
                </p>
                <p className="text-xs font-bold text-white">Wall detected 🎯</p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                    ARCore active
                </p>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Welcome() {
    const [activeRole, setActiveRole] = useState<number>(0);
    const [menuOpen, setMenuOpen] = useState<boolean>(false);
    const [scrolled, setScrolled] = useState<boolean>(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 40);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Close mobile menu on resize
    useEffect(() => {
        const onResize = () => {
            if (window.innerWidth >= 768) setMenuOpen(false);
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    return (
        <div
            className="min-h-screen overflow-x-hidden bg-[#070c18] text-slate-100"
            style={{ fontFamily: "'Poppins', sans-serif" }}
        >
            {/* Google Font */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap');
                @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
                @keyframes scan { 0%{top:20%;opacity:0} 10%{opacity:1} 90%{opacity:1} 100%{top:80%;opacity:0} }
                @keyframes pulse-ring { 0%,100%{box-shadow:0 0 0 0 rgba(59,130,246,0.4)} 50%{box-shadow:0 0 0 8px rgba(59,130,246,0)} }
                ::-webkit-scrollbar{width:4px}
                ::-webkit-scrollbar-track{background:#070c18}
                ::-webkit-scrollbar-thumb{background:#3b82f6;border-radius:4px}
            `}</style>

            {/* ── NAV ── */}
            <nav
                className={`fixed top-0 right-0 left-0 z-50 transition-all duration-300 ${scrolled ? 'border-b border-white/5 bg-[#070c18]/90 backdrop-blur-xl' : 'bg-transparent'}`}
            >
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
                    {/* Logo */}
                    <div className="flex items-center gap-2.5">
                        <img src={LOGO} alt="logo" className="h-8 w-auto" />
                    </div>

                    {/* Desktop links */}
                    <div className="hidden items-center gap-8 md:flex">
                        {NAV_LINKS.map((l) => (
                            <a
                                key={l}
                                href={`#${l.toLowerCase().replace(/ /g, '-')}`}
                                className="text-sm font-medium text-slate-400 transition-colors hover:text-white"
                            >
                                {l}
                            </a>
                        ))}
                    </div>

                    {/* Desktop CTA */}
                    <div className="hidden items-center gap-3 md:flex">
                        <button className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 transition-all hover:border-white/25 hover:bg-white/5">
                            Contact Us
                        </button>
                    </div>

                    {/* Mobile hamburger */}
                    <button
                        className="flex flex-col gap-1.5 p-1 md:hidden"
                        onClick={() => setMenuOpen(!menuOpen)}
                        aria-label="Toggle menu"
                    >
                        <span
                            className={`block h-0.5 w-6 bg-slate-300 transition-all duration-300 ${menuOpen ? 'translate-y-2 rotate-45' : ''}`}
                        />
                        <span
                            className={`block h-0.5 w-6 bg-slate-300 transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`}
                        />
                        <span
                            className={`block h-0.5 w-6 bg-slate-300 transition-all duration-300 ${menuOpen ? '-translate-y-2 -rotate-45' : ''}`}
                        />
                    </button>
                </div>

                {/* Mobile menu */}
                <div
                    className={`overflow-hidden transition-all duration-300 md:hidden ${menuOpen ? 'max-h-80 border-b border-white/5' : 'max-h-0'}`}
                >
                    <div className="flex flex-col gap-4 bg-[#070c18]/95 px-5 pt-2 pb-6 backdrop-blur-xl">
                        {NAV_LINKS.map((l) => (
                            <a
                                key={l}
                                href={`#${l.toLowerCase().replace(/ /g, '-')}`}
                                className="py-1 text-sm font-medium text-slate-300"
                                onClick={() => setMenuOpen(false)}
                            >
                                {l}
                            </a>
                        ))}
                        <div className="flex flex-col gap-2 border-t border-white/5 pt-2">
                            <button className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-300">
                                Contact Us
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* ── HERO ── */}
            <section
                id="features"
                className="relative flex min-h-screen items-center overflow-hidden px-5 pt-24 pb-20 sm:px-8"
                style={{
                    backgroundImage:
                        'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
                    backgroundSize: '60px 60px',
                }}
            >
                {/* Background glows */}
                <div className="pointer-events-none absolute top-1/4 right-0 h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-3xl" />
                <div className="pointer-events-none absolute bottom-0 left-0 h-96 w-96 rounded-full bg-blue-800/10 blur-3xl" />

                <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-16 lg:grid-cols-2">
                    {/* Left */}
                    <div>
                        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-blue-500/25 bg-blue-500/10 px-4 py-1.5">
                            <span
                                className="h-2 w-2 rounded-full bg-blue-400"
                                style={{
                                    animation: 'pulse-ring 1.5s ease infinite',
                                }}
                            />
                            <span className="text-xs font-semibold tracking-widest text-blue-300 uppercase">
                                AR-Powered · No App Needed
                            </span>
                        </div>

                        <h1 className="mb-6 text-4xl leading-[1.08] font-black tracking-tight text-white sm:text-5xl xl:text-6xl">
                            See your glass &<br />
                            <span className="text-blue-400">
                                aluminum works
                            </span>
                            <br />
                            before we install.
                        </h1>

                        <p className="mb-10 max-w-lg text-base leading-relaxed text-slate-400 sm:text-lg">
                            Point your phone at any wall, tap to measure, and
                            instantly visualize sliding windows, glass doors,
                            shopfronts, and cabinets — all in your actual space.
                        </p>

                        <div className="mb-12 flex flex-wrap gap-3">
                            <button className="rounded-2xl bg-blue-500 px-7 py-3.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-blue-600 hover:shadow-xl hover:shadow-blue-500/30 sm:text-base">
                                Try AR Visualizer →
                            </button>
                            <button className="rounded-2xl border border-white/10 px-7 py-3.5 text-sm font-semibold text-slate-200 transition-all hover:border-white/25 hover:bg-white/5 sm:text-base">
                                View Products
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-6 border-t border-white/5 pt-6">
                            {[
                                ['No app install', 'Opens in browser'],
                                ['Android & iOS', 'Both supported'],
                                ['±10cm accuracy', 'Good for quotes'],
                            ].map(([title, sub]) => (
                                <div key={title}>
                                    <p className="text-sm font-bold text-white">
                                        {title}
                                    </p>
                                    <p className="mt-0.5 text-xs text-slate-500">
                                        {sub}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right — phone mockup */}
                    <div className="flex justify-center lg:justify-end">
                        <ARPhoneMockup />
                    </div>
                </div>
            </section>

            {/* ── PRODUCTS ── */}
            <section id="products" className="bg-[#040810] px-5 py-24 sm:px-8">
                <div className="mx-auto max-w-7xl">
                    <FadeIn className="mb-16 text-center">
                        <p className="mb-4 text-xs font-bold tracking-[0.14em] text-blue-400 uppercase">
                            What We Offer
                        </p>
                        <h2 className="mb-4 text-3xl leading-tight font-black text-white sm:text-4xl lg:text-5xl">
                            Visualize any product,
                            <br className="hidden sm:block" /> on any wall
                        </h2>
                        <p className="mx-auto max-w-md text-base text-slate-400">
                            From a single screen door to a full kitchen cabinet
                            — see it in AR before you commit.
                        </p>
                    </FadeIn>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
                        {PRODUCTS.map((p, i) => (
                            <FadeIn key={p.name} delay={i * 0.07}>
                                <div className="cursor-pointer rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/30 hover:bg-blue-500/10 sm:p-7">
                                    <div className="mb-4 text-3xl">
                                        {p.icon}
                                    </div>
                                    <h3 className="mb-2 text-base font-bold text-white">
                                        {p.name}
                                    </h3>
                                    <p className="text-sm leading-relaxed text-slate-400">
                                        {p.desc}
                                    </p>
                                </div>
                            </FadeIn>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── HOW IT WORKS ── */}
            <section
                id="how-it-works"
                className="bg-[#070c18] px-5 py-24 sm:px-8"
                style={{
                    backgroundImage:
                        'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
                    backgroundSize: '60px 60px',
                }}
            >
                <div className="mx-auto max-w-4xl">
                    <FadeIn className="mb-16 text-center">
                        <p className="mb-4 text-xs font-bold tracking-[0.14em] text-blue-400 uppercase">
                            The Process
                        </p>
                        <h2 className="text-3xl leading-tight font-black text-white sm:text-4xl lg:text-5xl">
                            From camera to quote
                            <br className="hidden sm:block" /> in under 2
                            minutes
                        </h2>
                    </FadeIn>

                    <div className="relative">
                        {/* Vertical line */}
                        <div className="absolute top-6 bottom-6 left-6 w-0.5 rounded-full bg-gradient-to-b from-blue-500 to-blue-500/5 sm:left-7" />

                        <div className="flex flex-col">
                            {STEPS.map((step, i) => (
                                <FadeIn key={step.num} delay={i * 0.1}>
                                    <div className="flex items-start gap-6 py-6 sm:gap-8">
                                        <div
                                            className={`relative z-10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all sm:h-14 sm:w-14 ${
                                                i === 0
                                                    ? 'border-blue-500 bg-blue-500'
                                                    : 'border-blue-500/20 bg-[#070c18]'
                                            }`}
                                        >
                                            <span
                                                className={`text-xs font-black ${i === 0 ? 'text-white' : 'text-slate-500'}`}
                                            >
                                                {step.num}
                                            </span>
                                        </div>
                                        <div className="pt-2.5">
                                            <h3 className="mb-1.5 text-base font-bold text-white sm:text-lg">
                                                {step.title}
                                            </h3>
                                            <p className="max-w-xl text-sm leading-relaxed text-slate-400">
                                                {step.desc}
                                            </p>
                                        </div>
                                    </div>
                                </FadeIn>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── ROLES ── */}
            <section id="roles" className="bg-[#040810] px-5 py-24 sm:px-8">
                <div className="mx-auto max-w-4xl">
                    <FadeIn className="mb-12 text-center">
                        <p className="mb-4 text-xs font-bold tracking-[0.14em] text-blue-400 uppercase">
                            Built for Everyone
                        </p>
                        <h2 className="mb-3 text-3xl leading-tight font-black text-white sm:text-4xl lg:text-5xl">
                            One system, four roles
                        </h2>
                        <p className="text-base text-slate-400">
                            Every person in the workflow gets exactly what they
                            need.
                        </p>
                    </FadeIn>

                    <FadeIn delay={0.1}>
                        {/* Role tabs */}
                        <div className="mb-10 flex flex-wrap justify-center gap-2">
                            {ROLES.map((r, i) => (
                                <button
                                    key={r.role}
                                    onClick={() => setActiveRole(i)}
                                    className={`rounded-xl border px-5 py-2 text-sm font-semibold transition-all duration-200 ${
                                        activeRole === i
                                            ? 'border-blue-500 bg-blue-500 text-white'
                                            : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-white'
                                    }`}
                                >
                                    {r.emoji} {r.role}
                                </button>
                            ))}
                        </div>

                        {/* Role card */}
                        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 sm:p-10">
                            <div className="mb-8 flex items-center gap-4">
                                <div
                                    className={`flex h-12 w-12 items-center justify-center rounded-2xl border text-2xl ${ROLES[activeRole].accentClass}`}
                                >
                                    {ROLES[activeRole].emoji}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">
                                        {ROLES[activeRole].role}
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        {ROLES[activeRole].features.length}{' '}
                                        features included
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {ROLES[activeRole].features.map((f, i) => (
                                    <div
                                        key={i}
                                        className="flex items-start gap-3"
                                    >
                                        <div
                                            className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${ROLES[activeRole].checkClass}`}
                                        >
                                            ✓
                                        </div>
                                        <span className="text-sm leading-relaxed text-slate-300">
                                            {f}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </FadeIn>
                </div>
            </section>

            {/* ── PLATFORM COMPATIBILITY ── */}
            <section className="bg-[#070c18] px-5 py-16 sm:px-8">
                <div className="mx-auto max-w-4xl">
                    <FadeIn>
                        <div className="flex flex-col items-start gap-6 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 sm:flex-row sm:items-center sm:p-8">
                            <div className="flex-shrink-0 text-4xl">📱</div>
                            <div className="min-w-0 flex-1">
                                <h3 className="mb-1.5 text-base font-bold text-white sm:text-lg">
                                    Works on Android & iPhone
                                </h3>
                                <p className="text-sm leading-relaxed text-slate-400">
                                    Full AR measurement + visualization on
                                    Android Chrome. iPhone users get a seamless
                                    AR preview via Apple Quick Look with manual
                                    size input — no app download required on
                                    either device.
                                </p>
                            </div>
                            <div className="flex flex-shrink-0 gap-6">
                                <div className="text-center">
                                    <div className="mb-1 text-2xl">🤖</div>
                                    <p className="text-[11px] font-bold text-emerald-400">
                                        Full AR
                                    </p>
                                    <p className="text-[10px] text-slate-500">
                                        Android
                                    </p>
                                </div>
                                <div className="text-center">
                                    <div className="mb-1 text-2xl">🍎</div>
                                    <p className="text-[11px] font-bold text-amber-400">
                                        AR Preview
                                    </p>
                                    <p className="text-[10px] text-slate-500">
                                        iPhone
                                    </p>
                                </div>
                            </div>
                        </div>
                    </FadeIn>
                </div>
            </section>

            {/* ── CTA ── */}
            <section className="relative overflow-hidden bg-[#040810] px-5 py-28 sm:px-8 sm:py-36">
                <div className="pointer-events-none absolute top-1/2 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/10 blur-3xl" />
                <div className="relative mx-auto max-w-2xl text-center">
                    <FadeIn>
                        <p className="mb-5 text-xs font-bold tracking-[0.14em] text-blue-400 uppercase">
                            Get Started Today
                        </p>
                        <h2 className="mb-5 text-3xl leading-[1.08] font-black tracking-tight text-white sm:text-4xl lg:text-5xl xl:text-6xl">
                            Let your customers see it
                            <br className="hidden sm:block" /> before you build
                            it.
                        </h2>
                        <p className="mx-auto mb-12 max-w-lg text-base leading-relaxed text-slate-400 sm:text-lg">
                            Give your glass and aluminum business a competitive
                            edge. Let customers visualize, measure, and book —
                            all from their phone, all without an app.
                        </p>
                        <div className="flex flex-wrap justify-center gap-3">
                            <button className="rounded-2xl border border-white/10 px-8 py-3.5 text-base font-semibold text-slate-200 transition-all hover:border-white/25 hover:bg-white/5">
                                Contact Us
                            </button>
                        </div>
                    </FadeIn>
                </div>
            </section>

            {/* ── FOOTER ── */}
            <footer className="border-t border-white/5 px-5 py-8 sm:px-8">
                <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 text-center sm:flex-row sm:text-left">
                    <div className="flex items-center gap-2">
                        <img src={LOGO} alt="logo" className="h-8 w-auto" />
                    </div>
                    <p className="order-last text-xs text-slate-500 sm:order-none">
                        © 2026 GlassViz. AR-powered glass & aluminum works
                        system.
                    </p>
                    <div className="flex gap-6">
                        {['Privacy', 'Terms', 'Contact'].map((l) => (
                            <a
                                key={l}
                                href="#"
                                className="text-xs text-slate-500 transition-colors hover:text-slate-300"
                            >
                                {l}
                            </a>
                        ))}
                    </div>
                </div>
            </footer>
        </div>
    );
}
