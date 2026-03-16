import { useState, useEffect } from 'react';
import SHOWER_ENCLOSURE from "../../images/show_enclosure.jpeg";
import SHOP_FRONTS from '../../images/shop_fronts.jpg';
import SCREEN_DOOR from '../../images/screen_door.jpeg';
import HINGED_DOOR from '../../images/hinged_door.jpg';
import GLASS_DOOR from '../../images/glass_door.jpg';
import FRAMELESS_SHOWER from '../../images/frameless_shower.jpeg';
import FIXED_PANELS from '../../images/fixed_panels.jpeg';
import ALUMINUM_WINDOWS from '../../images/aluminum_window.jpg';
import ACP_CABINET from '../../images/acp_cabinets.jpeg';
// ── Data ──────────────────────────────────────────────────────────────────────
const DOOR_PRODUCTS = [
    {
        id: 1,
        name: 'Screen Door',
        category: 'Aluminum Doors',
        desc: 'Heavy-duty aluminum mesh frames built for ventilation and security in any opening.',
        img: SCREEN_DOOR
    },
    {
        id: 2,
        name: 'Glass Door',
        category: 'Aluminum Doors',
        desc: 'Tempered clear or frosted glass panels set in precision-machined aluminum profiles.',
        img: GLASS_DOOR
    },
    {
        id: 3,
        name: 'Sliding & Hinged Door',
        category: 'Aluminum Doors',
        desc: 'Space-saving sliding tracks and classic hinged configurations — made to measure.',
        img: HINGED_DOOR
    },
    {
        id: 4,
        name: 'Shop Fronts',
        category: 'Aluminum Doors',
        desc: 'Commercial aluminum shop fronts engineered for high-traffic retail environments.',
        img: SHOP_FRONTS
    },
    {
        id: 5,
        name: 'ACP Cabinets',
        category: 'Aluminum Doors',
        desc: 'Aluminum composite panel cabinets — lightweight, weather-resistant, and modern.',
        img: ACP_CABINET
    },
];
const WINDOW_PRODUCTS = [
    {
        id: 6,
        name: 'Aluminum Windows',
        category: 'Windows & Shower',
        desc: 'Casement, awning, louvre, and fixed types — all precision-engineered to order.',
        img: ALUMINUM_WINDOWS
    },
    {
        id: 7,
        name: 'Shower Enclosure',
        category: 'Windows & Shower',
        desc: 'Full-frame enclosures with polished aluminum profiles and certified safety glass.',
        img: SHOWER_ENCLOSURE
    },
    {
        id: 8,
        name: 'Frameless Shower',
        category: 'Windows & Shower',
        desc: 'Minimalist hardware-concealed panels delivering a spa-grade aesthetic.',
        img: FRAMELESS_SHOWER
    },
    {
        id: 9,
        name: 'Fixed Panel',
        category: 'Windows & Shower',
        desc: 'Structural fixed glass for balustrades, partitions, and architectural facades.',
        img: FIXED_PANELS
    },
];
const ALL_PRODUCTS = [...DOOR_PRODUCTS, ...WINDOW_PRODUCTS];

const PROJECTS = [
    {
        id: 1,
        title: 'Cavite Residence',
        location: 'Imus, Cavite',
        year: '2024',
        tag: 'Residential',
        img: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&q=80',
    },
    {
        id: 2,
        title: 'BGC Office Tower',
        location: 'Taguig City',
        year: '2023',
        tag: 'Commercial',
        img: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=900&q=80',
    },
    {
        id: 3,
        title: 'Luxury Villa Facade',
        location: 'Tagaytay',
        year: '2024',
        tag: 'Luxury',
        img: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=900&q=80',
    },
    {
        id: 4,
        title: 'Retail Shop Fronts',
        location: 'SM Dasmariñas',
        year: '2023',
        tag: 'Retail',
        img: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=900&q=80',
    },
];

const WHY_ITEMS = [
    {
        icon: '⏱',
        title: 'On-Time Delivery',
        desc: 'Every project is completed on schedule with no compromise on quality.',
    },
    {
        icon: '📐',
        title: 'Tailored Solutions',
        desc: 'We create engineering plans that precisely match your requirements.',
    },
    {
        icon: '🏅',
        title: 'Diverse Expertise',
        desc: 'Our team brings experienced engineers with deep technical knowledge.',
    },
    {
        icon: '✔',
        title: 'Continuous Quality Assurance',
        desc: 'We monitor every project stage to guarantee outcomes align with client specs.',
    },
];

const PROCESS_STEPS = [
    {
        num: '01',
        title: 'Discovery & Analysis',
        desc: 'We start by understanding your goals and analyzing project needs to define the right direction.',
    },
    {
        num: '02',
        title: 'Design & Innovation',
        desc: 'Ideas are transformed into detailed engineering plans that blend creativity with practical solutions.',
    },
    {
        num: '03',
        title: 'Coordination & Execution',
        desc: 'We manage coordination and supervise execution to ensure every detail aligns with the original plan.',
    },
    {
        num: '04',
        title: 'Delivery & Support',
        desc: 'Projects are delivered on time with quality assurance and we remain available for ongoing support.',
    },
];

// ── Navbar ────────────────────────────────────────────────────────────────────
function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    const [open, setOpen] = useState(false);
    useEffect(() => {
        const fn = () => setScrolled(window.scrollY > 10);
        window.addEventListener('scroll', fn);
        return () => window.removeEventListener('scroll', fn);
    }, []);
    return (
        <nav
            className={`fixed inset-x-0 top-0 z-50 bg-white transition-all duration-300 ${scrolled ? 'bg-white py-3 shadow-md' : 'border-b border-gray-100 bg-white py-4 backdrop-blur-sm'}`}
        >
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
                <a href="#" className="flex items-center gap-2.5">
                    <span className="text-xl font-bold tracking-tight text-gray-900">
                        Glass<span className="text-blue-600">Viz</span>
                    </span>
                </a>
                <div className="hidden items-center gap-7 md:flex">
                    {[
                        'Home',
                        'Products',
                        'AR Preview',
                        'Projects',
                        'Appointments',
                        'Contact',
                    ].map((l) => (
                        <a
                            key={l}
                            href={`#${l.toLowerCase().replace(' ', '-')}`}
                            className="text-sm font-medium text-gray-600 transition-colors hover:text-blue-600"
                        >
                            {l}
                        </a>
                    ))}
                </div>
                <div className="hidden items-center gap-3 md:flex">
                    <a href='/ar' className="rounded-lg px-4 py-2 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50">
                        AR Preview
                    </a>
                    <button
                        className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90"
                        style={{
                            background:
                                'linear-gradient(135deg,#1a56db,#3b82f6)',
                        }}
                    >
                        Free Consultation
                    </button>
                </div>
                <button
                    className="p-2 md:hidden"
                    onClick={() => setOpen(!open)}
                >
                    <div className="mb-1.5 h-0.5 w-5 bg-gray-700" />
                    <div className="mb-1.5 h-0.5 w-5 bg-gray-700" />
                    <div className="h-0.5 w-3.5 bg-gray-700" />
                </button>
            </div>
            {open && (
                <div className="space-y-3 border-t border-gray-100 bg-white px-6 py-4 md:hidden">
                    {[
                        'Home',
                        'Products',
                        'AR Preview',
                        'Projects',
                        'Appointments',
                        'Contact',
                    ].map((l) => (
                        <a
                            key={l}
                            href="#"
                            className="block py-1 text-sm font-medium text-gray-700"
                        >
                            {l}
                        </a>
                    ))}
                    <button
                        className="mt-2 w-full rounded-xl py-3 text-sm font-bold text-white"
                        style={{
                            background:
                                'linear-gradient(135deg,#1a56db,#3b82f6)',
                        }}
                    >
                        Free Consultation
                    </button>
                </div>
            )}
        </nav>
    );
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function Hero() {
    return (
        <section id="home" className="pt-[72px]">
            <div className="grid lg:grid-cols-2" style={{ minHeight: 620 }}>
                {/* Left */}
                <div
                    className="flex flex-col justify-center px-8 py-20 lg:px-16"
                    style={{ background: '#eef2ff' }}
                >
                    <p className="mb-5 flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-blue-600 uppercase">
                        <span className="inline-block h-px w-8 bg-blue-600" />{' '}
                        Designing for the Future
                    </p>
                    <h1
                        className="mb-6 text-5xl leading-[1.08] font-black text-gray-900 lg:text-6xl"
                    >
                        Building with
                        <br />
                        Purpose and
                        <br />
                        <span className="text-blue-600 ">Awareness</span>
                    </h1>
                    <p className="mb-8 max-w-md text-base leading-relaxed text-gray-500">
                        At GlassViz, we combine craftsmanship and precision to
                        deliver forward-thinking aluminum and glass solutions —
                        now with AR-powered previews so you can see it before we
                        build it.
                    </p>
                    <div className="flex flex-wrap gap-4">
                        <a href="#products">
                            <button
                                className="rounded-xl px-7 py-3.5 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg"
                                style={{
                                    background:
                                        'linear-gradient(135deg,#1a56db,#3b82f6)',
                                }}
                            >
                                Explore Our Products
                            </button>
                        </a>
                        <a href="#ar-preview">
                            <button className="rounded-xl border border-gray-200 bg-white px-7 py-3.5 text-sm font-bold text-gray-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300">
                                <a href="/ar">Launch AR Preview</a>
                            </button>
                        </a>
                    </div>
                    <div className="mt-12 flex gap-10 border-t border-gray-200 pt-8">
                        {[
                            ['1,200+', 'Projects Done'],
                            ['15 yrs', 'Experience'],
                            ['98%', 'Satisfaction'],
                        ].map(([v, l]) => (
                            <div key={l}>
                                <div className="text-2xl font-black text-gray-900">
                                    {v}
                                </div>
                                <div className="mt-0.5 text-xs text-gray-400">
                                    {l}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                {/* Right */}
                <div className="relative hidden overflow-hidden lg:block">
                    <img
                        src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=80"
                        alt="Modern Glass Building"
                        className="h-full w-full object-cover"
                        style={{ minHeight: 620 }}
                    />
                    <div
                        className="absolute inset-0"
                        style={{
                            background:
                                'linear-gradient(to right, rgba(238,242,255,0.15) 0%, transparent 20%)',
                        }}
                    />
                    {/* Floating project card */}
                    <div
                        className="absolute bottom-10 left-6 w-60 rounded-2xl bg-white p-4 shadow-2xl"
                        style={{ border: '1px solid rgba(0,0,0,0.07)' }}
                    >
                        <div className="flex items-start gap-3">
                            <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl">
                                <img
                                    src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=200&q=80"
                                    alt=""
                                    className="h-full w-full object-cover"
                                />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-gray-900">
                                    Explore Our Projects
                                </div>
                                <div className="mt-1 text-xs leading-relaxed text-gray-400">
                                    We carefully manage every project to ensure
                                    timely delivery with uncompromised quality.
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Stats badge */}
                    <div className="absolute top-10 right-8 flex items-center gap-3 rounded-2xl bg-white px-5 py-3.5 shadow-xl">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-lg">
                            😊
                        </div>
                        <div>
                            <div className="text-xl leading-none font-black text-gray-900">
                                10k+
                            </div>
                            <div className="mt-0.5 text-xs text-gray-400">
                                Happy homeowners
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

// ── About ─────────────────────────────────────────────────────────────────────
function About() {
    return (
        <section className="bg-white py-24">
            <div className="mx-auto grid max-w-7xl items-center gap-20 px-6 lg:grid-cols-2">
                <div className="relative">
                    <img
                        src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=900&q=80"
                        alt="Team working"
                        className="h-[440px] w-full rounded-2xl object-cover"
                    />
                    <div className="absolute -right-5 -bottom-5 hidden rounded-2xl bg-blue-600 p-6 text-center shadow-xl lg:block">
                        <div className="text-4xl leading-none font-black text-white">
                            120+
                        </div>
                        <div className="mt-1.5 text-xs leading-snug font-medium text-blue-200">
                            Projects
                            <br />
                            Delivered
                        </div>
                    </div>
                </div>
                <div>
                    <p className="mb-3 text-xs font-bold tracking-[0.18em] text-blue-600 uppercase">
                        We Design with Vision, We Build with Confidence
                    </p>
                    <h2
                        className="mb-4 text-4xl font-black text-gray-900"
                    >
                        Built for the Future
                    </h2>
                    <p className="mb-8 max-w-lg text-sm leading-relaxed text-gray-500">
                        GlassViz offers innovative glass and aluminum solutions
                        aligned with future architecture and construction
                        trends. Every detail is handled with precision and care.
                    </p>
                    <div className="space-y-5">
                        {[
                            {
                                t: 'Client-Centered Focus',
                                d: "We listen to our clients' needs and transform their visions into reality while ensuring the highest craftsmanship standards are met.",
                            },
                            {
                                t: 'Passionate About Innovation',
                                d: 'Our team of creative engineers is committed to excellence in every project phase, guaranteeing quality and precision.',
                            },
                            {
                                t: 'Our Achievements Make a Difference',
                                d: 'With 120+ projects across residential, commercial, and retail sectors, our track record speaks for itself.',
                            },
                        ].map((item) => (
                            <div key={item.t} className="flex gap-4">
                                <span className="mt-0.5 flex-shrink-0 text-lg font-black text-red-500">
                                    ✦
                                </span>
                                <div>
                                    <div className="mb-1 text-sm font-bold text-gray-900">
                                        {item.t}
                                    </div>
                                    <div className="text-sm leading-relaxed text-gray-500">
                                        {item.d}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <a
                        href="#"
                        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gray-100 px-5 py-2.5 text-sm font-bold text-gray-800 transition-colors hover:bg-gray-200"
                    >
                        Learn more <span>↗</span>
                    </a>
                </div>
            </div>
        </section>
    );
}

// ── Services / Products (tab layout like reference) ───────────────────────────
function Services() {
    const [active, setActive] = useState(0);
    return (
        <section
            id="products"
            className="py-24"
            style={{ background: '#f7f9ff' }}
        >
            <div className="mx-auto max-w-7xl px-6">
                <div className="mb-12 flex flex-col justify-between lg:flex-row lg:items-end">
                    <div>
                        <p className="mb-3 text-xs font-bold tracking-[0.18em] text-blue-600 uppercase">
                            Innovative Solutions to Meet Your Needs
                        </p>
                        <h2
                            className="text-4xl font-black text-gray-900"
                        >
                            Our Products
                        </h2>
                    </div>
                    <p className="mt-4 max-w-md text-sm leading-relaxed text-gray-500 lg:mt-0">
                        GlassViz provides a full spectrum of aluminum and glass
                        works ensuring exceptional quality and precision across
                        all stages of a project.
                    </p>
                    <a
                        href="#"
                        className="mt-4 hidden flex-shrink-0 items-center gap-2 rounded-xl border border-blue-200 px-5 py-2.5 text-sm font-bold text-blue-600 transition-colors hover:bg-blue-50 lg:mt-0 lg:inline-flex"
                    >
                        Learn more ↗
                    </a>
                </div>

                {/* Tabbed panel — desktop */}
                <div
                    className="hidden overflow-hidden rounded-2xl border border-gray-100 shadow-xl lg:flex"
                    style={{ minHeight: 480 }}
                >
                    {/* Image panel */}
                    <div className="relative flex-1 overflow-hidden">
                        <img
                            src={ALL_PRODUCTS[active].img}
                            alt={ALL_PRODUCTS[active].name}
                            className="h-full w-full object-cover transition-all duration-500"
                            style={{ minHeight: 480 }}
                        />
                        <div
                            className="absolute inset-0"
                            style={{
                                background:
                                    'linear-gradient(to top, rgba(10,20,50,0.75) 0%, rgba(10,20,50,0.1) 55%, transparent 100%)',
                            }}
                        />
                        <div className="absolute bottom-0 left-0 p-8">
                            <span className="mb-3 inline-block rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white">
                                {ALL_PRODUCTS[active].category}
                            </span>
                            <h3
                                className="mb-2 text-2xl font-black text-white"
                            >
                                {ALL_PRODUCTS[active].name}
                            </h3>
                            <p className="max-w-sm text-sm leading-relaxed text-white/70">
                                {ALL_PRODUCTS[active].desc}
                            </p>
                            <div className="mt-5 flex gap-3">
                                <button
                                    className="rounded-xl px-5 py-2.5 text-sm font-bold text-white"
                                    style={{
                                        background:
                                            'linear-gradient(135deg,#1a56db,#3b82f6)',
                                    }}
                                >
                                    📱 AR Preview
                                </button>
                                <button className="rounded-xl border border-white/30 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/10">
                                    Get Quote
                                </button>
                            </div>
                        </div>
                    </div>
                    {/* Tab list */}
                    <div className="w-64 flex-shrink-0 divide-y divide-gray-100 overflow-y-auto bg-white">
                        {ALL_PRODUCTS.map((p, i) => (
                            <button
                                key={p.id}
                                onClick={() => setActive(i)}
                                className={`group flex w-full items-center gap-3 px-5 py-4 text-left transition-all ${active === i ? 'bg-blue-600' : 'hover:bg-gray-50'}`}
                            >
                                <span
                                    className={`w-5 flex-shrink-0 font-mono text-xs font-black ${active === i ? 'text-blue-200' : 'text-gray-300'}`}
                                >
                                    {String(i + 1).padStart(2, '0')}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div
                                        className={`truncate text-sm font-bold ${active === i ? 'text-white' : 'text-gray-800'}`}
                                    >
                                        {p.name}
                                    </div>
                                    <div
                                        className={`mt-0.5 truncate text-xs ${active === i ? 'text-blue-200' : 'text-gray-400'}`}
                                    >
                                        {p.category}
                                    </div>
                                </div>
                                <span
                                    className={`flex-shrink-0 text-xs ${active === i ? 'text-white' : 'text-gray-300 group-hover:text-blue-500'}`}
                                >
                                    ›
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Mobile grid */}
                <div className="mt-2 grid gap-5 sm:grid-cols-2 lg:hidden">
                    {ALL_PRODUCTS.map((p, i) => (
                        <div
                            key={p.id}
                            className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm"
                        >
                            <img
                                src={p.img}
                                alt={p.name}
                                className="h-40 w-full object-cover"
                            />
                            <div className="p-4">
                                <div className="mb-1 text-xs font-bold text-blue-600">
                                    {p.category}
                                </div>
                                <div className="mb-1 text-sm font-bold text-gray-900">
                                    {p.name}
                                </div>
                                <p className="text-xs leading-relaxed text-gray-500">
                                    {p.desc}
                                </p>
                                <div className="mt-3 flex gap-2">
                                    <button
                                        className="flex-1 rounded-lg py-2 text-xs font-bold text-white"
                                        style={{ background: '#1a56db' }}
                                    >
                                        AR Preview
                                    </button>
                                    <button className="flex-1 rounded-lg border border-gray-200 py-2 text-xs font-bold text-gray-600">
                                        Quote
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ── Projects ──────────────────────────────────────────────────────────────────
function ProjectsSection() {
    return (
        <section id="projects" className="bg-white py-24">
            <div className="mx-auto max-w-7xl px-6">
                <div className="mb-12 flex items-end justify-between">
                    <div>
                        <p className="mb-3 text-xs font-bold tracking-[0.18em] text-blue-600 uppercase">
                            Expertise Reflected in Every Project
                        </p>
                        <h2
                            className="text-4xl font-black text-gray-900"
                        >
                            Our Projects
                        </h2>
                        <p className="mt-3 max-w-lg text-sm leading-relaxed text-gray-500">
                            At GlassViz, we are committed to delivering projects
                            that make a lasting impact through creative
                            precision and high-quality design execution.
                        </p>
                    </div>
                    <a
                        href="#"
                        className="ml-8 hidden flex-shrink-0 items-center gap-2 rounded-xl border border-blue-200 px-5 py-2.5 text-sm font-bold text-blue-600 transition-colors hover:bg-blue-50 md:inline-flex"
                    >
                        Learn more ↗
                    </a>
                </div>
                {/* 1 big + 3 small grid matching reference */}
                <div className="grid h-72 grid-cols-4 gap-4 lg:h-96">
                    <div className="group relative col-span-2 cursor-pointer overflow-hidden rounded-2xl">
                        <img
                            src={PROJECTS[0].img}
                            alt={PROJECTS[0].title}
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div
                            className="absolute inset-0"
                            style={{
                                background:
                                    'linear-gradient(to top,rgba(10,20,50,0.72) 0%,transparent 55%)',
                            }}
                        />
                        <div className="absolute bottom-5 left-5">
                            <div className="mb-1 text-xs font-bold tracking-wide text-blue-300 uppercase">
                                {PROJECTS[0].tag}
                            </div>
                            <div className="text-lg font-black text-white">
                                {PROJECTS[0].title}
                            </div>
                            <div className="mt-1 text-xs text-white/60">
                                📍 {PROJECTS[0].location} · {PROJECTS[0].year}
                            </div>
                        </div>
                    </div>
                    {PROJECTS.slice(1).map((p) => (
                        <div
                            key={p.id}
                            className="group relative cursor-pointer overflow-hidden rounded-2xl"
                        >
                            <img
                                src={p.img}
                                alt={p.title}
                                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                            <div
                                className="absolute inset-0"
                                style={{
                                    background:
                                        'linear-gradient(to top,rgba(10,20,50,0.72) 0%,transparent 55%)',
                                }}
                            />
                            <div className="absolute bottom-4 left-4">
                                <div className="mb-0.5 text-xs font-bold tracking-wide text-blue-300 uppercase">
                                    {p.tag}
                                </div>
                                <div className="text-sm leading-tight font-bold text-white">
                                    {p.title}
                                </div>
                                <div className="mt-0.5 text-xs text-white/55">
                                    📍 {p.location}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ── Why Choose ────────────────────────────────────────────────────────────────
function WhySection() {
    return (
        <section className="py-24" style={{ background: '#f7f9ff' }}>
            <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 lg:grid-cols-2">
                <div>
                    <p className="mb-3 text-xs font-bold tracking-[0.18em] text-blue-600 uppercase">
                        Where Creativity Meets Precision
                    </p>
                    <h2
                        className="mb-4 text-4xl font-black text-gray-900"
                    >
                        Why Choose
                        <br />
                        GlassViz?
                    </h2>
                    <p className="mb-10 max-w-md text-sm leading-relaxed text-gray-500">
                        In a world that demands precision and innovative
                        engineering, GlassViz delivers added value across every
                        project through a holistic approach focused on detail
                        and long-term success.
                    </p>
                    <div className="space-y-3">
                        {WHY_ITEMS.map((item, i) => (
                            <div
                                key={item.title}
                                className={`flex cursor-default items-start gap-4 rounded-xl p-4 transition-all ${i === 0 ? 'bg-blue-600 shadow-lg' : 'border border-gray-100 bg-white hover:shadow-md'}`}
                            >
                                <div
                                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold ${i === 0 ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'}`}
                                >
                                    {item.icon}
                                </div>
                                <div>
                                    <div
                                        className={`mb-0.5 text-sm font-bold ${i === 0 ? 'text-white' : 'text-gray-900'}`}
                                    >
                                        {item.title}
                                    </div>
                                    <div
                                        className={`text-xs leading-relaxed ${i === 0 ? 'text-blue-100' : 'text-gray-500'}`}
                                    >
                                        {item.desc}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <a
                        href="#"
                        className="mt-7 inline-flex items-center gap-2 rounded-xl bg-gray-100 px-5 py-2.5 text-sm font-bold text-gray-800 transition-colors hover:bg-gray-200"
                    >
                        Learn more ↗
                    </a>
                </div>
                <div className="relative hidden lg:block">
                    <img
                        src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&q=80"
                        alt="Consultation"
                        className="h-[500px] w-full rounded-2xl object-cover"
                    />
                    {/* AR quote floating card */}
                    <div className="absolute top-1/3 -left-8 w-52 rounded-2xl border border-gray-100 bg-white p-4 shadow-2xl">
                        <div className="mb-1 text-xs font-medium text-gray-400">
                            AR Quote Estimate
                        </div>
                        <div className="text-2xl font-black text-gray-900">
                            ₱12,400
                        </div>
                        <div className="mt-1 text-xs text-gray-400">
                            Glass Sliding Door · 900×2100mm
                        </div>
                        <button
                            className="mt-3 w-full rounded-lg py-2 text-xs font-bold text-white"
                            style={{
                                background:
                                    'linear-gradient(135deg,#1a56db,#3b82f6)',
                            }}
                        >
                            Book Inspection →
                        </button>
                    </div>
                    {/* Circular badge */}
                    <div className="absolute -right-4 bottom-16 flex h-20 w-20 flex-col items-center justify-center rounded-full border border-gray-100 bg-white shadow-xl">
                        <div className="text-xl text-blue-600">↗</div>
                    </div>
                </div>
            </div>
        </section>
    );
}

// ── Process ───────────────────────────────────────────────────────────────────
function ProcessSection() {
    return (
        <section className="py-24" style={{ background: '#0d2159' }}>
            <div className="mx-auto grid max-w-7xl items-start gap-16 px-6 lg:grid-cols-2">
                <div>
                    <p className="mb-3 text-xs font-bold tracking-[0.18em] text-blue-300 uppercase">
                        From Vision To Completion
                    </p>
                    <h2
                        className="mb-5 text-4xl leading-tight font-black text-white"
                    >
                        Our Process to Bring
                        <br />
                        Your Ideas to Life
                    </h2>
                    <p className="mb-8 max-w-md text-sm leading-relaxed text-blue-200/70">
                        We follow a clear, well-structured process that combines
                        thoughtful planning, strategic creativity, and technical
                        precision. At every stage we prioritize innovation,
                        ensuring results that are visually engaging,
                        user-friendly, and aligned with client goals.
                    </p>
                    <button className="inline-flex items-center gap-2 rounded-xl border border-blue-400/30 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10">
                        Get Started ↗
                    </button>
                </div>
                <div className="space-y-4">
                    {PROCESS_STEPS.map((step) => (
                        <div
                            key={step.num}
                            className="group flex cursor-default gap-5 rounded-xl border border-white/10 p-5 transition-all hover:border-blue-400/30"
                            style={{ background: 'rgba(255,255,255,0.04)' }}
                        >
                            <div
                                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl font-mono text-xs font-black text-white"
                                style={{
                                    background:
                                        'linear-gradient(135deg,#1a56db,#3b82f6)',
                                }}
                            >
                                {step.num}
                            </div>
                            <div>
                                <div className="mb-1 text-sm font-bold text-white transition-colors group-hover:text-blue-300">
                                    {step.title}
                                </div>
                                <div className="text-xs leading-relaxed text-blue-200/60">
                                    {step.desc}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ── Appointment ───────────────────────────────────────────────────────────────
function AppointmentSection() {
    const [form, setForm] = useState({
        name: '',
        phone: '',
        email: '',
        address: '',
        product: '',
        date: '',
        notes: '',
    });
    const [done, setDone] = useState(false);
    const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

    if (done)
        return (
            <section id="appointments" className="bg-white py-24 text-center">
                <div className="mx-auto max-w-sm px-6">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-2xl">
                        ✓
                    </div>
                    <h2 className="mb-3 text-2xl font-black text-gray-900">
                        Appointment Confirmed!
                    </h2>
                    <p className="mb-6 text-sm text-gray-500">
                        Our team will call you within 24 hours to confirm your
                        home visit schedule.
                    </p>
                    <button
                        onClick={() => setDone(false)}
                        className="rounded-xl px-6 py-3 text-sm font-bold text-white shadow-md"
                        style={{ background: '#1a56db' }}
                    >
                        Book Another
                    </button>
                </div>
            </section>
        );

    return (
        <section id="appointments" className="bg-white py-24">
            <div className="mx-auto grid max-w-7xl items-start gap-20 px-6 lg:grid-cols-2">
                <div>
                    <p className="mb-3 text-xs font-bold tracking-[0.18em] text-blue-600 uppercase">
                        Book a Home Visit
                    </p>
                    <h2
                        className="mb-5 text-4xl font-black text-gray-900"
                    >
                        Free On-Site
                        <br />
                        <span className="text-blue-600">Inspection.</span>
                    </h2>
                    <p className="mb-8 max-w-md text-sm leading-relaxed text-gray-500">
                        Our certified technicians visit your home, measure
                        precisely, and provide a detailed no-obligation
                        quotation — completely free of charge.
                    </p>
                    <div className="mb-8 space-y-3">
                        {[
                            'Precise on-site measurement of all openings',
                            'Product recommendation tailored to your space',
                            'Material samples to see and feel in person',
                            'Transparent itemized quote on the spot',
                        ].map((item) => (
                            <div key={item} className="flex items-center gap-3">
                                <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50">
                                    <div className="h-2 w-2 rounded-full bg-blue-600" />
                                </div>
                                <span className="text-sm text-gray-600">
                                    {item}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center gap-4 rounded-xl border border-blue-100 bg-blue-50 p-5">
                        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xl text-white">
                            📱
                        </div>
                        <div>
                            <div className="text-sm font-bold text-gray-900">
                                Get an instant AR Quote first
                            </div>
                            <div className="mt-0.5 text-xs text-gray-500">
                                Use your phone camera to measure and get a price
                                estimate before booking.
                            </div>
                            <a
                                href="#ar-preview"
                                className="mt-1 inline-block text-xs font-bold text-blue-600"
                            >
                                Launch AR Preview →
                            </a>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-xl">
                    <h3 className="mb-6 text-lg font-black text-gray-900">
                        Schedule Your Visit
                    </h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <Field
                                label="Full Name"
                                placeholder="Juan dela Cruz"
                                value={form.name}
                                onChange={(v) => set('name', v)}
                            />
                            <Field
                                label="Phone"
                                placeholder="+63 9XX XXX XXXX"
                                value={form.phone}
                                onChange={(v) => set('phone', v)}
                            />
                        </div>
                        <Field
                            label="Email"
                            placeholder="juan@email.com"
                            value={form.email}
                            onChange={(v) => set('email', v)}
                        />
                        <Field
                            label="Home Address"
                            placeholder="Barangay, City, Province"
                            value={form.address}
                            onChange={(v) => set('address', v)}
                        />
                        <div>
                            <label className="mb-1.5 block text-xs font-bold tracking-wider text-gray-400 uppercase">
                                Product Interest
                            </label>
                            <select
                                value={form.product}
                                onChange={(e) => set('product', e.target.value)}
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 transition-colors outline-none focus:border-blue-400"
                            >
                                <option value="">Select a product…</option>
                                {ALL_PRODUCTS.map((p) => (
                                    <option key={p.id} value={p.name}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <Field
                            label="Preferred Visit Date"
                            placeholder=""
                            value={form.date}
                            onChange={(v) => set('date', v)}
                            type="date"
                        />
                        <div>
                            <label className="mb-1.5 block text-xs font-bold tracking-wider text-gray-400 uppercase">
                                Notes (Optional)
                            </label>
                            <textarea
                                rows={3}
                                placeholder="Any specifics about your space…"
                                value={form.notes}
                                onChange={(e) => set('notes', e.target.value)}
                                className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 transition-colors outline-none focus:border-blue-400"
                            />
                        </div>
                        <button
                            onClick={() =>
                                form.name && form.phone && setDone(true)
                            }
                            className="w-full rounded-xl py-3.5 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg"
                            style={{
                                background:
                                    'linear-gradient(135deg,#1a56db,#3b82f6)',
                            }}
                        >
                            Book Free Inspection →
                        </button>
                        <p className="text-center text-xs text-gray-400">
                            No payment required. Cancel anytime.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}

function Field({
    label,
    placeholder,
    value,
    onChange,
    type = 'text',
}: {
    label: string;
    placeholder: string;
    value: string;
    onChange: (v: string) => void;
    type?: string;
}) {
    return (
        <div>
            <label className="mb-1.5 block text-xs font-bold tracking-wider text-gray-400 uppercase">
                {label}
            </label>
            <input
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 placeholder-gray-300 transition-colors outline-none focus:border-blue-400"
            />
        </div>
    );
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
    return (
        <footer className="bg-gray-900 pt-16 pb-8">
            <div className="mx-auto mb-12 grid max-w-7xl gap-10 px-6 md:grid-cols-4">
                <div className="md:col-span-2">
                    <div className="mb-4 flex items-center gap-2.5">
                        
                        <span className="text-xl font-bold text-white">
                            Glass<span className="text-blue-400">Viz</span>
                        </span>
                    </div>
                    <p className="mb-5 max-w-xs text-sm leading-relaxed text-gray-400">
                        Premium glass and aluminum works with AR-powered
                        previews and instant quoting.
                    </p>
                    <div className="flex gap-2">
                        {['FB', 'IG', 'YT'].map((s) => (
                            <div
                                key={s}
                                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-gray-800 text-xs font-bold text-gray-400 transition-all hover:bg-blue-600 hover:text-white"
                            >
                                {s}
                            </div>
                        ))}
                    </div>
                </div>
                <div>
                    <div className="mb-4 text-sm font-bold text-white">
                        Products
                    </div>
                    <div className="space-y-2">
                        {ALL_PRODUCTS.map((p) => (
                            <a
                                key={p.id}
                                href="#"
                                className="block text-xs text-gray-400 transition-colors hover:text-white"
                            >
                                {p.name}
                            </a>
                        ))}
                    </div>
                </div>
                <div>
                    <div className="mb-4 text-sm font-bold text-white">
                        Contact
                    </div>
                    <div className="space-y-2.5 text-xs text-gray-400">
                        <div>📍 Imus, Cavite, Philippines</div>
                        <div>📞 +63 9XX XXX XXXX</div>
                        <div>✉️ hello@glassviz.ph</div>
                        <div>🕐 Mon–Sat, 8AM–6PM</div>
                    </div>
                </div>
            </div>
            <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 border-t border-gray-800 px-6 pt-6 md:flex-row">
                <p className="text-xs text-gray-600">
                    © 2026 GlassViz. All rights reserved.
                </p>
                <div className="flex gap-5 text-xs text-gray-600">
                    <a href="#" className="hover:text-gray-400">
                        Privacy Policy
                    </a>
                    <a href="#" className="hover:text-gray-400">
                        Terms of Service
                    </a>
                </div>
            </div>
        </footer>
    );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function Welcome() {
    return (
        <div
            className="min-h-screen antialiased"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Playfair+Display:ital,wght@0,700;0,900;1,700&display=swap');
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
      `}</style>
            <Navbar />
            <Hero />
            <About />
            <Services />
            <WhySection />
            <ProcessSection />
            <AppointmentSection />
            <Footer />
        </div>
    );
}
