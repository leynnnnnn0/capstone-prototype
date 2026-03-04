import { useState, useEffect, useRef, ReactNode } from "react";
import LOGO from "../../images/whiteLogo.png";
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

const NAV_LINKS: string[] = ["Features", "Products", "How It Works", "Roles"];

const PRODUCTS: Product[] = [
    { name: "Sliding Windows", icon: "⬜", desc: "Visualize aluminum sliding windows on your walls before installation." },
    { name: "Glass Doors", icon: "🚪", desc: "Full-glass and framed door overlays with real-time AR preview." },
    { name: "Screen Doors", icon: "🔲", desc: "See exactly how screen doors fit your entrance in augmented reality." },
    { name: "Shop Fronts", icon: "🏪", desc: "Preview commercial glass shopfronts scaled to your actual facade." },
    { name: "ACP Cabinets", icon: "🗄️", desc: "Aluminum composite panel cabinet visualization for any space." },
    { name: "Kitchen Cabinets", icon: "🍳", desc: "L-shape and U-shape kitchen cabinet layouts in your actual kitchen." },
];

const STEPS: Step[] = [
    { num: "01", title: "Open the Website", desc: "No app download needed. Open on any Android phone using Chrome — that's it." },
    { num: "02", title: "Point at the Wall", desc: "Grant camera access and point your phone at the window area. ARCore detects the surface automatically." },
    { num: "03", title: "Tap to Measure", desc: "Tap two points on screen to mark width and height. Real-world dimensions are calculated instantly." },
    { num: "04", title: "See It in AR", desc: "Your chosen product appears on your wall at exact scale. Switch styles and colors in real time." },
    { num: "05", title: "Get Your Quote", desc: "Measurements auto-fill a price estimate. Review it and book an on-site appointment in one tap." },
];

const ROLES: Role[] = [
    {
        role: "Customer",
        emoji: "👤",
        accentClass: "bg-blue-500/10 border-blue-500/30 text-blue-400",
        checkClass: "bg-blue-500",
        features: [
            "AR camera measurement — no tape measure needed",
            "Visualize windows, doors & cabinets on your actual wall",
            "Instant auto-generated price quotation",
            "Browse full product catalog",
            "Online appointment booking",
            "Download quotation as PDF",
            "SMS & email confirmation",
        ],
    },
    {
        role: "Staff",
        emoji: "👨‍💼",
        accentClass: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
        checkClass: "bg-emerald-500",
        features: [
            "Manage & confirm appointments",
            "Review and finalize quotations",
            "Full customer records & history",
            "Update product catalog & pricing",
            "Inventory monitoring",
            "Low stock alerts",
            "Log completed jobs & payments",
        ],
    },
    {
        role: "Installer",
        emoji: "🔧",
        accentClass: "bg-amber-500/10 border-amber-500/30 text-amber-400",
        checkClass: "bg-amber-500",
        features: [
            "View assigned jobs & schedules",
            "Access customer measurements & specs",
            "Update job status in real time",
            "Daily & weekly installation calendar",
            "Submit job completion reports",
        ],
    },
    {
        role: "Owner",
        emoji: "👑",
        accentClass: "bg-purple-500/10 border-purple-500/30 text-purple-400",
        checkClass: "bg-purple-500",
        features: [
            "KPI dashboard — revenue, bookings, conversion",
            "Monthly & yearly sales reports",
            "Inventory & material consumption reports",
            "Staff performance tracking",
            "Quotation-to-job conversion rate",
            "Full system control",
            "Appointment calendar overview",
        ],
    },
];

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useInView(threshold = 0.15): [React.RefObject<HTMLDivElement>, boolean] {
    const ref = useRef<HTMLDivElement>(null);
    const [inView, setInView] = useState<boolean>(false);

    useEffect(() => {
        const obs = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) setInView(true); },
            { threshold }
        );
        if (ref.current) obs.observe(ref.current);
        return () => obs.disconnect();
    }, [threshold]);

    return [ref, inView];
}

// ─── Components ───────────────────────────────────────────────────────────────

function FadeIn({ children, delay = 0, className = "" }: FadeInProps) {
    const [ref, inView] = useInView();
    return (
        <div
            ref={ref}
            className={className}
            style={{
                opacity: inView ? 1 : 0,
                transform: inView ? "translateY(0px)" : "translateY(24px)",
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
            <div className="absolute w-64 h-64 bg-blue-500/20 rounded-full blur-3xl" />

            {/* Phone */}
            <div className="relative w-52 h-[420px] sm:w-56 sm:h-[448px] bg-slate-900 rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl shadow-black/60 animate-[float_4s_ease-in-out_infinite]">
                {/* Notch */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-5 bg-slate-950 rounded-xl z-10" />

                {/* Screen content */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800">
                    {/* Grid lines simulating room */}
                    <div className="absolute inset-0 opacity-10"
                        style={{
                            backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
                            backgroundSize: "40px 40px"
                        }}
                    />

                    {/* AR Window overlay */}
                    <div className="absolute top-[28%] left-[15%] right-[15%] h-[38%] border-2 border-blue-400/80 rounded bg-blue-400/8">
                        {/* Panes */}
                        <div className="absolute inset-2 grid grid-cols-2 gap-1">
                            {[0, 1, 2, 3].map(i => (
                                <div key={i} className="bg-blue-300/10 rounded border border-blue-400/20" />
                            ))}
                        </div>
                        {/* Width label */}
                        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[9px] font-bold px-2 py-0.5 rounded whitespace-nowrap">
                            1.2m wide
                        </div>
                        {/* Height label */}
                        <div className="absolute top-1/2 -right-8 -translate-y-1/2 bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                            0.9m
                        </div>
                    </div>

                    {/* Corner tap dots */}
                    {([[15, 28], [85, 28], [15, 66], [85, 66]] as [number, number][]).map(([x, y], i) => (
                        <div
                            key={i}
                            className="absolute w-2.5 h-2.5 rounded-full border-2 border-blue-400 bg-blue-400/30"
                            style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)" }}
                        />
                    ))}

                    {/* Scan line */}
                    <div
                        className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent"
                        style={{ animation: "scan 2.5s ease-in-out infinite" }}
                    />
                </div>

                {/* Bottom UI */}
                <div className="absolute bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur px-4 pt-3 pb-7">
                    <p className="text-[10px] text-slate-400 mb-2 uppercase tracking-widest">Detected: Sliding Window</p>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-slate-300 font-medium">Est. Price</p>
                            <p className="text-lg font-bold text-blue-400">₱12,500</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Floating card — measurement */}
            <div className="absolute top-4 -right-2 sm:-right-8 bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl px-3 py-2.5 w-32">
                <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-widest mb-1">Measurement</p>
                <p className="text-sm font-bold text-white">1.2m × 0.9m</p>
                <p className="text-[10px] text-emerald-400 mt-0.5">✓ Auto-detected</p>
            </div>

            {/* Floating card — status */}
            <div className="absolute bottom-16 -left-2 sm:-left-10 bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl px-3 py-2.5 w-32">
                <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-widest mb-1">Status</p>
                <p className="text-xs font-bold text-white">Wall detected 🎯</p>
                <p className="text-[10px] text-slate-400 mt-0.5">ARCore active</p>
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
        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    // Close mobile menu on resize
    useEffect(() => {
        const onResize = () => { if (window.innerWidth >= 768) setMenuOpen(false); };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    return (
        <div className="min-h-screen bg-[#070c18] text-slate-100 overflow-x-hidden" style={{ fontFamily: "'Poppins', sans-serif" }}>

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
            <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#070c18]/90 backdrop-blur-xl border-b border-white/5" : "bg-transparent"}`}>
                <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">

                    {/* Logo */}
                    <div className="flex items-center gap-2.5">
                      <img src={LOGO} alt="logo" className="h-8 w-auto" />
                    </div>

                    {/* Desktop links */}
                    <div className="hidden md:flex items-center gap-8">
                        {NAV_LINKS.map(l => (
                            <a key={l} href={`#${l.toLowerCase().replace(/ /g, "-")}`}
                                className="text-sm text-slate-400 hover:text-white transition-colors font-medium">
                                {l}
                            </a>
                        ))}
                    </div>

                    {/* Desktop CTA */}
                    <div className="hidden md:flex items-center gap-3">
                        <button className="text-sm font-semibold text-slate-300 border border-white/10 hover:border-white/25 hover:bg-white/5 px-4 py-2 rounded-xl transition-all">
                            Contact Us
                        </button>

                    </div>

                    {/* Mobile hamburger */}
                    <button
                        className="md:hidden flex flex-col gap-1.5 p-1"
                        onClick={() => setMenuOpen(!menuOpen)}
                        aria-label="Toggle menu"
                    >
                        <span className={`block w-6 h-0.5 bg-slate-300 transition-all duration-300 ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
                        <span className={`block w-6 h-0.5 bg-slate-300 transition-all duration-300 ${menuOpen ? "opacity-0" : ""}`} />
                        <span className={`block w-6 h-0.5 bg-slate-300 transition-all duration-300 ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
                    </button>
                </div>

                {/* Mobile menu */}
                <div className={`md:hidden overflow-hidden transition-all duration-300 ${menuOpen ? "max-h-80 border-b border-white/5" : "max-h-0"}`}>
                    <div className="bg-[#070c18]/95 backdrop-blur-xl px-5 pb-6 pt-2 flex flex-col gap-4">
                        {NAV_LINKS.map(l => (
                            <a key={l} href={`#${l.toLowerCase().replace(/ /g, "-")}`}
                                className="text-sm text-slate-300 font-medium py-1"
                                onClick={() => setMenuOpen(false)}>
                                {l}
                            </a>
                        ))}
                        <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                            <button className="text-sm font-semibold text-slate-300 border border-white/10 px-4 py-2.5 rounded-xl">Contact Us</button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* ── HERO ── */}
            <section
                id="features"
                className="relative min-h-screen flex items-center pt-24 pb-20 px-5 sm:px-8 overflow-hidden"
                style={{
                    backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
                    backgroundSize: "60px 60px"
                }}
            >
                {/* Background glows */}
                <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-800/10 rounded-full blur-3xl pointer-events-none" />

                <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

                    {/* Left */}
                    <div>
                        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/25 rounded-full px-4 py-1.5 mb-7">
                            <span className="w-2 h-2 bg-blue-400 rounded-full" style={{ animation: "pulse-ring 1.5s ease infinite" }} />
                            <span className="text-xs font-semibold text-blue-300 tracking-widest uppercase">AR-Powered · No App Needed</span>
                        </div>

                        <h1 className="text-4xl sm:text-5xl xl:text-6xl font-black text-white leading-[1.08] mb-6 tracking-tight">
                            See your glass &<br />
                            <span className="text-blue-400">aluminum works</span><br />
                            before we install.
                        </h1>

                        <p className="text-base sm:text-lg text-slate-400 leading-relaxed max-w-lg mb-10">
                            Point your phone at any wall, tap to measure, and instantly visualize sliding windows, glass doors, shopfronts, and cabinets — all in your actual space.
                        </p>

                        <div className="flex flex-wrap gap-3 mb-12">
                            <button className="bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm sm:text-base px-7 py-3.5 rounded-2xl transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/30">
                                Try AR Visualizer →
                            </button>
                            <button className="text-slate-200 font-semibold text-sm sm:text-base border border-white/10 hover:border-white/25 hover:bg-white/5 px-7 py-3.5 rounded-2xl transition-all">
                                View Products
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-6 pt-6 border-t border-white/5">
                            {[
                                ["No app install", "Opens in browser"],
                                ["Android & iOS", "Both supported"],
                                ["±10cm accuracy", "Good for quotes"],
                            ].map(([title, sub]) => (
                                <div key={title}>
                                    <p className="text-sm font-bold text-white">{title}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
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
            <section id="products" className="py-24 px-5 sm:px-8 bg-[#040810]">
                <div className="max-w-7xl mx-auto">
                    <FadeIn className="text-center mb-16">
                        <p className="text-xs font-bold tracking-[0.14em] text-blue-400 uppercase mb-4">What We Offer</p>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4 leading-tight">
                            Visualize any product,<br className="hidden sm:block" /> on any wall
                        </h2>
                        <p className="text-slate-400 text-base max-w-md mx-auto">
                            From a single screen door to a full kitchen cabinet — see it in AR before you commit.
                        </p>
                    </FadeIn>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                        {PRODUCTS.map((p, i) => (
                            <FadeIn key={p.name} delay={i * 0.07}>
                                <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 sm:p-7 hover:bg-blue-500/10 hover:border-blue-500/30 hover:-translate-y-1 transition-all duration-300 cursor-pointer">
                                    <div className="text-3xl mb-4">{p.icon}</div>
                                    <h3 className="text-base font-bold text-white mb-2">{p.name}</h3>
                                    <p className="text-sm text-slate-400 leading-relaxed">{p.desc}</p>
                                </div>
                            </FadeIn>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── HOW IT WORKS ── */}
            <section
                id="how-it-works"
                className="py-24 px-5 sm:px-8 bg-[#070c18]"
                style={{
                    backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
                    backgroundSize: "60px 60px"
                }}
            >
                <div className="max-w-4xl mx-auto">
                    <FadeIn className="text-center mb-16">
                        <p className="text-xs font-bold tracking-[0.14em] text-blue-400 uppercase mb-4">The Process</p>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight">
                            From camera to quote<br className="hidden sm:block" /> in under 2 minutes
                        </h2>
                    </FadeIn>

                    <div className="relative">
                        {/* Vertical line */}
                        <div className="absolute left-6 sm:left-7 top-6 bottom-6 w-0.5 bg-gradient-to-b from-blue-500 to-blue-500/5 rounded-full" />

                        <div className="flex flex-col">
                            {STEPS.map((step, i) => (
                                <FadeIn key={step.num} delay={i * 0.1}>
                                    <div className="flex gap-6 sm:gap-8 py-6 items-start">
                                        <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center flex-shrink-0 relative z-10 border-2 transition-all
                                            ${i === 0
                                                ? "bg-blue-500 border-blue-500"
                                                : "bg-[#070c18] border-blue-500/20"}`}>
                                            <span className={`text-xs font-black ${i === 0 ? "text-white" : "text-slate-500"}`}>
                                                {step.num}
                                            </span>
                                        </div>
                                        <div className="pt-2.5">
                                            <h3 className="text-base sm:text-lg font-bold text-white mb-1.5">{step.title}</h3>
                                            <p className="text-sm text-slate-400 leading-relaxed max-w-xl">{step.desc}</p>
                                        </div>
                                    </div>
                                </FadeIn>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── ROLES ── */}
            <section id="roles" className="py-24 px-5 sm:px-8 bg-[#040810]">
                <div className="max-w-4xl mx-auto">
                    <FadeIn className="text-center mb-12">
                        <p className="text-xs font-bold tracking-[0.14em] text-blue-400 uppercase mb-4">Built for Everyone</p>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-3 leading-tight">
                            One system, four roles
                        </h2>
                        <p className="text-slate-400 text-base">
                            Every person in the workflow gets exactly what they need.
                        </p>
                    </FadeIn>

                    <FadeIn delay={0.1}>
                        {/* Role tabs */}
                        <div className="flex flex-wrap justify-center gap-2 mb-10">
                            {ROLES.map((r, i) => (
                                <button
                                    key={r.role}
                                    onClick={() => setActiveRole(i)}
                                    className={`px-5 py-2 rounded-xl text-sm font-semibold border transition-all duration-200
                                        ${activeRole === i
                                            ? "bg-blue-500 border-blue-500 text-white"
                                            : "border-white/10 text-slate-400 hover:text-white hover:border-white/20"}`}
                                >
                                    {r.emoji} {r.role}
                                </button>
                            ))}
                        </div>

                        {/* Role card */}
                        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 sm:p-10">
                            <div className="flex items-center gap-4 mb-8">
                                <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center text-2xl ${ROLES[activeRole].accentClass}`}>
                                    {ROLES[activeRole].emoji}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">{ROLES[activeRole].role}</h3>
                                    <p className="text-xs text-slate-500">{ROLES[activeRole].features.length} features included</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {ROLES[activeRole].features.map((f, i) => (
                                    <div key={i} className="flex items-start gap-3">
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-white font-bold ${ROLES[activeRole].checkClass}`}>
                                            ✓
                                        </div>
                                        <span className="text-sm text-slate-300 leading-relaxed">{f}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </FadeIn>
                </div>
            </section>

            {/* ── PLATFORM COMPATIBILITY ── */}
            <section className="py-16 px-5 sm:px-8 bg-[#070c18]">
                <div className="max-w-4xl mx-auto">
                    <FadeIn>
                        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
                            <div className="text-4xl flex-shrink-0">📱</div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-base sm:text-lg font-bold text-white mb-1.5">Works on Android & iPhone</h3>
                                <p className="text-sm text-slate-400 leading-relaxed">
                                    Full AR measurement + visualization on Android Chrome. iPhone users get a seamless AR preview via Apple Quick Look with manual size input — no app download required on either device.
                                </p>
                            </div>
                            <div className="flex gap-6 flex-shrink-0">
                                <div className="text-center">
                                    <div className="text-2xl mb-1">🤖</div>
                                    <p className="text-[11px] font-bold text-emerald-400">Full AR</p>
                                    <p className="text-[10px] text-slate-500">Android</p>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl mb-1">🍎</div>
                                    <p className="text-[11px] font-bold text-amber-400">AR Preview</p>
                                    <p className="text-[10px] text-slate-500">iPhone</p>
                                </div>
                            </div>
                        </div>
                    </FadeIn>
                </div>
            </section>

            {/* ── CTA ── */}
            <section className="relative py-28 sm:py-36 px-5 sm:px-8 bg-[#040810] overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative max-w-2xl mx-auto text-center">
                    <FadeIn>
                        <p className="text-xs font-bold tracking-[0.14em] text-blue-400 uppercase mb-5">Get Started Today</p>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-black text-white mb-5 leading-[1.08] tracking-tight">
                            Let your customers see it<br className="hidden sm:block" /> before you build it.
                        </h2>
                        <p className="text-slate-400 text-base sm:text-lg leading-relaxed mb-12 max-w-lg mx-auto">
                            Give your glass and aluminum business a competitive edge. Let customers visualize, measure, and book — all from their phone, all without an app.
                        </p>
                        <div className="flex flex-wrap justify-center gap-3">
                           
                            <button className="text-slate-200 font-semibold text-base border border-white/10 hover:border-white/25 hover:bg-white/5 px-8 py-3.5 rounded-2xl transition-all">
                                Contact Us
                            </button>
                        </div>
                    </FadeIn>
                </div>
            </section>

            {/* ── FOOTER ── */}
            <footer className="border-t border-white/5 px-5 sm:px-8 py-8">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-5 text-center sm:text-left">
                    <div className="flex items-center gap-2">
                           <img src={LOGO} alt="logo" className="h-8 w-auto" />
                    </div>
                    <p className="text-xs text-slate-500 order-last sm:order-none">
                        © 2026 GlassViz. AR-powered glass & aluminum works system.
                    </p>
                    <div className="flex gap-6">
                        {["Privacy", "Terms", "Contact"].map(l => (
                            <a key={l} href="#" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">{l}</a>
                        ))}
                    </div>
                </div>
            </footer>

        </div>
    );
}