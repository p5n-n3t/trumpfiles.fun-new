"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShinyButton } from "@/components/ui/shiny-button";
import { PulsatingButton } from "@/components/ui/pulsating-button";
import { Badge } from "@/components/ui/badge";
import { 
    Database, 
    BarChart3, 
    Shield, 
    Zap, 
    Flame, 
    Brain, 
    Heart, 
    Fingerprint as LucideFingerprint, 
    TrendingUp as LucideTrendingUp 
} from "lucide-react";
import {
    TrumpFilesBrand,
    TrumpFilesHeading,
} from "@/components/TrumpFilesBrand";
import { MagicCard } from "@/components/ui/magic-card";
import GradientBlinds from "@/components/GradientBlinds";
import { BentoCard, BentoGrid } from "@/components/ui/bento-grid";
import { Marquee } from "@/components/ui/marquee";
import { AICompleteTrumpData } from "@/types/database";
import ShinyText from "@/components/ShinyText";
import ElectricBorder from "@/components/ElectricBorder";
import { SparklesText } from "@/components/ui/sparkles-text";
import { ShineBorder } from "@/components/ui/shine-border";
import { HyperText } from "@/components/ui/hyper-text";

// Dynamically import 3D component
const OrangeHero = dynamic(() => import("@/components/OrangeHero"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-[500px] flex items-center justify-center">
            <div className="animate-pulse text-2xl text-primary">Loading 3D Model...</div>
        </div>
    ),
});

const getCategoryColor = (category: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
        'Insurrection': { bg: 'bg-red-500/30', text: 'text-red-400', border: 'border-red-500/50' },
        'Corruption': { bg: 'bg-orange-500/30', text: 'text-orange-400', border: 'border-orange-500/50' },
        'Obstruction': { bg: 'bg-yellow-500/30', text: 'text-yellow-400', border: 'border-yellow-500/50' },
        'Legal': { bg: 'bg-blue-500/30', text: 'text-blue-400', border: 'border-blue-500/50' },
        'Political': { bg: 'bg-purple-500/30', text: 'text-purple-400', border: 'border-purple-500/50' },
        'Foreign Policy': { bg: 'bg-green-500/30', text: 'text-green-400', border: 'border-green-500/50' },
        'Ethics': { bg: 'bg-pink-500/30', text: 'text-pink-400', border: 'border-pink-500/50' },
        'Business': { bg: 'bg-cyan-500/30', text: 'text-cyan-400', border: 'border-cyan-500/50' },
    };
    return colors[category] || { bg: 'bg-gray-500/30', text: 'text-gray-400', border: 'border-gray-500/50' };
};

const MarqueeCard = ({ entry }: { entry: AICompleteTrumpData }) => {
    const categoryStyle = getCategoryColor(entry.category);
    const dangerPercent = ((entry.danger || 0) / 10) * 100;
    const absurdityPercent = ((entry.absurdity || 0) / 10) * 100;

    return (
        <div className="w-[300px] sm:w-[420px] mx-2 sm:mx-4 p-4 sm:p-5 rounded-xl bg-black/50 backdrop-blur-sm border border-white/10 hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/10 transition-all duration-300 group">
            <div className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold mb-3 ${categoryStyle.bg} ${categoryStyle.text} ${categoryStyle.border} border`}>
                {entry.category}
            </div>
            <Link href={`/entry/${entry.entry_number}`} target="_blank" className="block">
                <h4 className="text-base font-bold text-white/90 line-clamp-1 mb-2 group-hover:text-orange-400 transition-colors cursor-pointer underline-offset-2 hover:underline font-display">
                    #{entry.entry_number}: {entry.title}
                </h4>
            </Link>
            <p className="text-sm text-foreground/70 line-clamp-3 mb-4 leading-relaxed">
                {entry.synopsis}
            </p>
            <div className="space-y-2">
                <div className="flex items-center gap-3">
                    <span className="text-xs text-red-400 w-16 flex items-center gap-1 font-ui"><Flame className="w-3.5 h-3.5" /> Danger</span>
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full" style={{ width: `${dangerPercent}%` }} />
                    </div>
                    <span className="text-xs text-white/80 w-10 text-right font-data">{entry.danger?.toFixed(1)}/10</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-yellow-400 w-16 flex items-center gap-1 font-ui"><Brain className="w-3.5 h-3.5" /> Absurd</span>
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-yellow-500 to-orange-400 rounded-full" style={{ width: `${absurdityPercent}%` }} />
                    </div>
                    <span className="text-xs text-white/80 w-10 text-right font-data">{entry.absurdity?.toFixed(1)}/10</span>
                </div>
            </div>
        </div>
    );
};

export default function HomeClient({
    initialEntries,
    entryCount,
    lastScrapedFormatted
}: {
    initialEntries: AICompleteTrumpData[];
    entryCount: number;
    lastScrapedFormatted: string;
}) {
    const features = [
        { icon: Database, title: `${entryCount}+ Documented Entries`, description: "Meticulously structured data with sources, scores, and fact-checks." },
        { icon: BarChart3, title: "Interactive Visualizations", description: "Discover patterns and relationships with D3.js-powered charts." },
        { icon: Shield, title: "Fact-Checked", description: "Every entry includes rigorous fact-checking and source verification." },
        { icon: Zap, title: "Real-time Analysis", description: "Thermal scoring system for danger, lawlessness, and absurdity metrics." },
    ];

    return (
        <div className="min-h-screen relative">
            <div className="fixed inset-0 w-full h-full z-0 opacity-30 pointer-events-none">
                <GradientBlinds gradientColors={["#FF6B00", "#FF8C00", "#FFA500", "#FFB733", "#FF8C00", "#FF6B00"]} angle={45} blindCount={24} blindMinWidth={50} noise={0.15} mouseDampening={0.2} spotlightRadius={0.6} spotlightOpacity={0.8} distortAmount={0.5} mirrorGradient={true} mixBlendMode="screen" />
            </div>

            <div className="relative z-10">
                {/* ── DESKTOP HERO (hidden on mobile) ── */}
                <section className="relative overflow-clip h-[calc(100dvh-64px)] hidden md:flex items-stretch py-2">
                    <div className="absolute -left-40 top-1/2 -translate-y-1/2 w-[625px] h-[625px] opacity-20 pointer-events-none hidden lg:block">
                        <img src="/images/bg-decor_wireframe_donut.svg" alt="" className="absolute inset-0 w-full h-full object-contain" />
                        <div className="absolute inset-0 w-full h-full animate-beam-pulse" style={{ background: 'radial-gradient(ellipse at center, rgba(255,165,0,0.3) 0%, transparent 60%)', mixBlendMode: 'overlay' }} />
                    </div>
                    <div className="absolute -right-24 top-1/3 w-[440px] h-[440px] opacity-15 pointer-events-none hidden lg:block">
                        <img src="/images/bg-decor_hula-hoops.svg" alt="" className="absolute inset-0 w-full h-full object-contain" />
                        <div className="absolute inset-0 w-full h-full rounded-full animate-beam-rotate" style={{ background: 'conic-gradient(from 0deg, transparent, rgba(255,100,0,0.4), transparent, rgba(255,165,0,0.4), transparent)', mixBlendMode: 'overlay' }} />
                    </div>

                    <div className="container mx-auto px-4 lg:px-12 relative z-10 w-full flex-grow">
                        <div className="grid lg:grid-cols-2 gap-4 lg:gap-12 h-full items-stretch max-w-7xl mx-auto">
                            <div className="flex flex-col h-full py-1 gap-3">
                                <div className="flex justify-start">
                                    <Badge className="bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-500 border-orange-500/30 px-4 py-1 text-sm">The Definitive Data-Driven Encyclopedia of Political Absurdity</Badge>
                                </div>
                                <div className="flex-1 flex flex-col justify-center text-left">
                                    <div className="py-1">
                                        <TrumpFilesBrand size="hero" className="justify-start whitespace-nowrap" />
                                    </div>
                                    {/* Creative mixed-typography description */}
                                    <div className="mt-3 max-w-xl space-y-1">
                                        <p className="text-[11px] font-mono text-orange-500/60 tracking-[0.2em] uppercase">// classified: public record</p>
                                        <p className="text-lg lg:text-xl font-black tracking-tight text-white/95 leading-tight" style={{ fontFamily: 'var(--font-outfit)' }}>
                                            Every scandal. Every lie. Every <span className="text-orange-400 italic" style={{ fontFamily: 'var(--font-arctic-guardian-grad-italic)' }}>abuse of power.</span>
                                        </p>
                                        <p className="text-sm text-foreground/65 leading-relaxed max-w-sm" style={{ fontFamily: 'var(--font-outfit)', fontWeight: 400 }}>
                                            Documented entries — scored, sourced, and archived so the record <span className="font-mono text-[12px] bg-white/5 px-1 rounded border border-white/10">survives</span> the churn.
                                        </p>
                                    </div>
                                    <div className="flex justify-start pt-3">
                                        <ElectricBorder color="#9eff2a" speed={1.5} chaos={0.08} borderRadius={16}>
                                            <div className="px-5 py-2 bg-gradient-to-r from-orange-950/80 via-black/70 to-orange-950/80 backdrop-blur-sm rounded-2xl border border-orange-500/10 flex flex-col items-center gap-0.5">
                                                <ShinyText text={`${entryCount}+ ENTRIES DOCUMENTED`} speed={2.9} delay={0.7} color="#ffb347" shineColor="#ffffff" spread={110} direction="left" yoyo pauseOnHover={false} disabled={false} className="text-sm font-bold tracking-wide" />
                                                {lastScrapedFormatted && <span className="text-[10px] text-orange-500/60 tracking-widest uppercase font-mono">Last updated {lastScrapedFormatted}</span>}
                                            </div>
                                        </ElectricBorder>
                                    </div>
                                </div>
                                {/* Buttons + blue box grouped so overflow-hidden can't clip the box */}
                                <div className="flex flex-col gap-3">
                                    <div className="flex flex-wrap gap-4 justify-start">
                                        <Link href="/catalog"><ShinyButton className="text-sm px-5 py-2.5 bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/50">Explore The Files</ShinyButton></Link>
                                        <Link href="/visualizer"><PulsatingButton className="text-sm px-5 py-2.5 bg-orange-600 hover:bg-orange-700">Visualize The Data</PulsatingButton></Link>
                                    </div>
                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0 }} className="max-w-md">
                                        <Link href="/donate">
                                            <div className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-950/40 to-slate-900/40 border border-blue-500/30 p-3 hover:border-blue-400/50 hover:bg-blue-900/20 transition-all cursor-pointer shadow-lg shadow-blue-900/10">
                                                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 group-hover:bg-blue-400 transition-colors" />
                                                <div className="flex items-start gap-3">
                                                    <div className="p-1.5 bg-blue-500/20 rounded-lg group-hover:scale-110 transition-transform"><Heart className="w-4 h-4 text-blue-400" /></div>
                                                    <div>
                                                        <h4 className="text-xs font-bold text-blue-300 uppercase tracking-wider mb-1 flex items-center gap-2">Message from the Creator <span className="text-[9px] bg-blue-500/20 px-1.5 py-0.5 rounded text-blue-300 border border-blue-500/30">Read</span></h4>
                                                        <p className="text-[11px] text-blue-100/70 leading-relaxed" style={{ fontFamily: 'var(--font-outfit)' }}>Building this archive from Lebanon comes with unique challenges. If you value this work, please read this note.</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    </motion.div>
                                </div>
                            </div>

                            <div className="flex flex-col h-full py-1 relative z-20 pl-8 lg:pl-12 gap-2">
                                <div className="hidden lg:flex justify-start items-center h-[24px] overflow-visible shrink-0">
                                    <img src="/images/bg-decor_repeating_front-slash.svg" alt="" className="w-[250px] h-auto object-left opacity-60" />
                                </div>
                                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.2 }} className="relative w-full flex-1 min-h-0 flex items-center justify-center">
                                    <div className="w-full max-w-[420px] lg:max-w-[500px]" style={{ aspectRatio: '1', maxHeight: 'calc(100dvh - 64px - 180px)' }}>
                                        <OrangeHero />
                                    </div>
                                </motion.div>
                                <div className="flex items-end gap-x-4 w-full justify-start lg:pl-8 shrink-0 pb-1">
                                    <div className="relative leading-none">
                                        <SparklesText className="text-5xl lg:text-7xl font-black tracking-tighter !leading-none block p-0 m-0" colors={{ first: '#FFA500', second: '#FF4500' }} style={{ fontFamily: 'var(--font-arctic-guardian-grad)', fontWeight: 900, background: 'linear-gradient(to bottom, #FFA500, #FF4500)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-block' }}>DJT</SparklesText>
                                    </div>
                                    <div className="relative h-16 lg:h-20 w-40 lg:w-48 mb-0.5">
                                        <div className="absolute inset-0 z-20 pointer-events-none rounded-lg overflow-hidden"><ShineBorder shineColor={["#FFA500", "#FF4500", "#FFD700"]} borderWidth={2} duration={4} className="w-full h-full" /></div>
                                        <div className="relative z-10 w-full h-full"><img src="/images/trump_signature_2.svg" alt="Signature" className="w-full h-full object-contain" /></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── MOBILE HERO (hidden on desktop) ── */}
                <section className="md:hidden relative overflow-hidden px-4 pt-4 pb-6">
                    <div className="flex flex-col items-center text-center gap-3">
                        {/* 1. Pill badge */}
                        <Badge className="bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-500 border-orange-500/30 px-3 py-1 text-[11px] max-w-[90vw] text-center">The Definitive Data-Driven Encyclopedia of Political Absurdity</Badge>

                        {/* 2. Title */}
                        <div className="py-1 w-full overflow-hidden">
                            <TrumpFilesBrand size="hero" className="justify-center !text-3xl scale-[0.85]" />
                        </div>

                        {/* 3. 3D Model */}
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.2 }} className="w-[70vw] max-w-[300px] aspect-square pointer-events-none">
                            <OrangeHero />
                        </motion.div>

                        {/* 4. Description text */}
                        <p className="text-sm text-foreground/80 max-w-[85vw] leading-relaxed font-medium font-editorial">
                            A comprehensive, data-driven archive of the 45th U.S. President&apos;s most controversial and impactful moments.
                        </p>

                        {/* 5. Entry counter */}
                        <div className="flex justify-center">
                            <ElectricBorder color="#9eff2a" speed={1.5} chaos={0.08} borderRadius={16}>
                                <div className="px-4 py-2 bg-gradient-to-r from-orange-950/80 via-black/70 to-orange-950/80 backdrop-blur-sm rounded-2xl border border-orange-500/10 flex flex-col items-center gap-0.5">
                                    <ShinyText text={`${entryCount}+ ENTRIES DOCUMENTED`} speed={2.9} delay={0.7} color="#ffb347" shineColor="#ffffff" spread={110} direction="left" yoyo pauseOnHover={false} disabled={false} className="text-xs font-bold tracking-wide" />
                                    {lastScrapedFormatted && <span className="text-[9px] text-orange-500/60 tracking-widest uppercase font-mono">Last updated {lastScrapedFormatted}</span>}
                                </div>
                            </ElectricBorder>
                        </div>

                        {/* 6. Buttons */}
                        <div className="flex gap-3 justify-center w-full max-w-[85vw]">
                            <Link href="/catalog" className="flex-1"><ShinyButton className="w-full text-xs px-3 py-2.5 bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/50">Explore The Files</ShinyButton></Link>
                            <Link href="/visualizer" className="flex-1"><PulsatingButton className="w-full text-xs px-3 py-2.5 bg-orange-600 hover:bg-orange-700">Visualize The Data</PulsatingButton></Link>
                        </div>

                        {/* 7. Blue box */}
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0 }} className="w-full max-w-[85vw]">
                            <Link href="/donate">
                                <div className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-950/40 to-slate-900/40 border border-blue-500/30 p-3 hover:border-blue-400/50 hover:bg-blue-900/20 transition-all cursor-pointer shadow-lg shadow-blue-900/10">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 group-hover:bg-blue-400 transition-colors" />
                                    <div className="flex items-start gap-2">
                                        <div className="p-1.5 bg-blue-500/20 rounded-lg flex-shrink-0"><Heart className="w-4 h-4 text-blue-400" /></div>
                                        <div>
                                            <h4 className="text-[11px] font-bold text-blue-300 uppercase tracking-wider mb-0.5 flex items-center gap-1">Message from the Creator <span className="text-[8px] bg-blue-500/20 px-1 py-0.5 rounded text-blue-300 border border-blue-500/30">Read</span></h4>
                                            <p className="text-[10px] text-blue-100/70 leading-relaxed font-sans">Building this archive from Lebanon comes with unique challenges. If you value this work, please read this note.</p>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        </motion.div>
                    </div>
                </section>

                <section className="golden-p-8">
                    <div className="container mx-auto px-4">
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-12">
                            <TrumpFilesHeading className="text-3xl lg:text-4xl font-bold mb-4">An Unprecedented Archive of a Presidency</TrumpFilesHeading>
                            <p className="text-lg text-foreground/70 max-w-2xl mx-auto">Our platform provides the tools to dissect, analyze, and comprehend the events that shaped a tumultuous era in American history.</p>
                        </motion.div>
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {features.map((feature, index) => (
                                <motion.div key={feature.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: index * 0.1 }}>
                                    <MagicCard className="glass-card border-white/10 p-6 h-full hover:border-primary/30 transition-all duration-300">
                                        <feature.icon className="h-10 w-10 text-primary mb-4" />
                                        <h3 className="text-xl font-semibold mb-2 font-heading bg-linear-to-r from-orange-500 via-orange-400 to-orange-600 bg-clip-text text-transparent">{feature.title}</h3>
                                        <p className="text-foreground/70">{feature.description}</p>
                                    </MagicCard>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="py-24 relative overflow-hidden">
                    <div className="container mx-auto px-4 relative z-10">
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-16 relative">
                            <div className="absolute -top-8 -right-4 lg:right-16 lg:-top-16 w-36 h-36 lg:w-48 lg:h-48 z-20 pointer-events-none opacity-80 rotate-12 overflow-visible">
                                <ElectricBorder color="#FFA500" speed={1.2} chaos={0.1}><img src="/images/trump_logo_ascii.svg" alt="ASCII Logo" className="w-full h-full object-contain p-2 bg-black/80 rounded-xl" /></ElectricBorder>
                            </div>
                            <HyperText className="text-4xl lg:text-5xl font-bold mb-4 bg-linear-to-r from-orange-500 via-orange-400 to-orange-600 bg-clip-text text-transparent block relative z-10" startOnView>Explore The Platform</HyperText>
                            <p className="text-lg text-foreground/70 max-w-2xl mx-auto relative z-10 mt-4">Interactive tools and insights to understand the most documented presidency in history</p>
                        </motion.div>
                        <BentoGrid className="mx-auto max-w-6xl">
                            <BentoCard name="Interactive Catalog" className="col-span-3 lg:col-span-2" background={<div className="absolute inset-0 bg-linear-to-br from-orange-500/20 to-red-500/10" />} Icon={Database} description={`Browse ${entryCount}+ meticulously documented entries with advanced filtering, scoring, and real-time updates.`} href="/catalog" cta="Explore Catalog" />
                            <BentoCard name="Data Visualizer" className="col-span-3 lg:col-span-1" background={<div className="absolute inset-0 bg-linear-to-br from-purple-500/20 to-orange-500/10" />} Icon={BarChart3} description="5 interactive chart types revealing patterns, trends, and insights across all dimensions." href="/visualizer" cta="View Charts" />
                            <BentoCard name="The Enigma" className="col-span-3 lg:col-span-1" background={<div className="absolute inset-0 bg-linear-to-br from-red-500/20 to-orange-500/10" />} Icon={LucideFingerprint} description="Explore the biographical timeline and key events that shaped the most controversial presidency." href="/enigma" cta="Discover Timeline" />
                            <BentoCard name="Real-Time Scoring" className="col-span-3 lg:col-span-2" background={<div className="absolute inset-0 bg-linear-to-br from-orange-500/20 to-yellow-500/10" />} Icon={LucideTrendingUp} description="AI-powered thermal scoring across 8 dimensions: danger, lawlessness, insanity, absurdity, and more." href="/catalog" cta="See Scores" />
                        </BentoGrid>
                    </div>
                </section>

                {initialEntries.length > 0 && (
                    <section className="py-16 relative overflow-hidden">
                        <div className="container mx-auto px-4 relative z-10 mb-10">
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center">
                                <div className="flex justify-center mb-6"><img src="/logos/trumpfiles_orange_logo.png" alt="Trump Files Logo" className="h-32 md:h-48 w-auto object-contain scale-110" style={{ filter: "drop-shadow(0 0 15px rgba(255, 165, 0, 0.4))" }} /></div>
                                <div className="inline-block px-8 py-4 rounded-xl bg-black/50 backdrop-blur-sm border border-orange-500/30 mb-4">
                                    <HyperText className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-orange-500 via-orange-400 to-orange-600 bg-clip-text text-transparent font-heading block" startOnView>Live Data Stream</HyperText>
                                </div>
                                <p className="text-base text-foreground/70 mt-2">{initialEntries.length} documented incidents streaming in real-time</p>
                            </motion.div>
                        </div>
                        <div className="relative">
                            <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
                            <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
                            <Marquee pauseOnHover className="[--duration:150s] [--gap:1.5rem]" repeat={2}>
                                {initialEntries.map((entry) => (<MarqueeCard key={entry.entry_number} entry={entry} />))}
                            </Marquee>
                        </div>
                    </section>
                )}

                <section className="relative py-24 overflow-hidden">
                    <div className="container mx-auto px-4 relative z-10">
                        <div className="max-w-6xl mx-auto grid lg:grid-cols-5 gap-8 items-center">
                            <div className="lg:col-span-3">
                                <div className="glass-card p-6 sm:p-12 text-center max-w-4xl mx-auto border-orange-500/20 shadow-lg shadow-orange-500/10 h-full">
                                    <HyperText className="text-4xl lg:text-5xl font-bold mb-8 bg-linear-to-r from-orange-500 via-orange-400 to-orange-600 bg-clip-text text-transparent block" startOnView>Our Mission</HyperText>
                                    <div className="space-y-6 text-lg text-foreground/80 leading-relaxed">
                                        <p><strong className="text-orange-400">Trumpstein Files</strong> is a half-scientific, half-satirical counter-archive leveraging AI to scrape, catalogue, and analyze the most fucked-up things Trump has ever said or done.</p>
                                        <p>We track not just headline scandals, but also the lies, insults, racist riffs, vanity spirals, corrupt little schemes, deranged policy theatrics, and primary-source Trump quotes that would get him laughed out of any hypothetical court of morality, ethics, manners, or basic human decency.</p>
                                        <p>This archive exists to <strong className="text-orange-400">beat flood-the-zone amnesia</strong>, preserve receipts for the historical record, support accountability, and give people a way to remember the pattern instead of drowning in the churn.</p>
                                        <p>Our goal? <strong className="text-orange-400">Jail, ridicule, or bar from heaven</strong>—whichever hits first.</p>
                                        <div className="pt-6 flex gap-4 justify-center">
                                            <Link href="/catalog"><Button className="bg-linear-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600">Explore The Archive</Button></Link>
                                            <Link href="/wtf"><Button variant="outline" className="border-orange-500/30 text-orange-400 hover:bg-orange-500/20">Learn More</Button></Link>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="lg:col-span-2 flex justify-center lg:justify-start">
                                <img src="/images/trump_macbeth.svg" alt="Trump Macbeth" className="w-full max-w-[400px] object-contain transform scale-110 lg:-translate-x-8" style={{ filter: "drop-shadow(0 0 20px rgba(255, 100, 0, 0.3))" }} />
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
