"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Menu,
  X,
  Home,
  Library,
  Brain,
  Fingerprint,
  Mail,
  Heart,
  FileSearch,
  Network,
} from "lucide-react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { TrumpFilesBrand } from "@/components/TrumpFilesBrand";
import { analytics } from "@/lib/analytics";

function ArcticNavLabel({ label }: { label: string }) {
  return (
    <span className="relative z-10 inline-flex items-baseline leading-none" aria-label={label} style={{ letterSpacing: "0.03em" }}>
      {Array.from(label).map((letter, index) => (
        <motion.span
          key={`${letter}-${index}`}
          className="inline-block"
          style={{
            fontFamily: "var(--font-arctic-guardian-half)",
            fontSize: "13px",
          }}
          variants={{
            rest: {
              y: 0,
              background: "linear-gradient(180deg, #ffffff 0%, #ffffff 50%, #ff8c00 80%, #ff6b00 100%)",
              backgroundClip: "text",
              color: "transparent",
            },
            hover: {
              y: index % 2 === 0 ? -3 : 2,
              background: "linear-gradient(180deg, #ff6b00 0%, #ff8c00 40%, #ffffff 70%, #ffffff 100%)",
              backgroundClip: "text",
              color: "transparent",
            },
          }}
          transition={{ duration: 0.18, delay: index * 0.022, ease: "easeOut" }}
          aria-hidden="true"
        >
          {letter === " " ? " " : letter}
        </motion.span>
      ))}
      <motion.span
        variants={{
          rest: { opacity: 0, scaleX: 0.3 },
          hover: { opacity: 1, scaleX: 1 },
        }}
        transition={{ duration: 0.2 }}
        className="absolute -bottom-1 left-0 h-[1.5px] w-full origin-left"
        style={{ background: "linear-gradient(90deg, #ff6b00, #fbbf24, #ff6b00)" }}
        aria-hidden="true"
      />
    </span>
  );
}

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const reduceMotion = useReducedMotion();
  const pathname = usePathname();

  const navItems = [
    { name: "Home", href: "/", icon: <Home size={16} /> },
    { name: "Catalog", href: "/catalog", icon: <Library size={16} /> },
    { name: "Insights", href: "/insights", icon: <FileSearch size={16} /> },
    { name: "Network", href: "/network", icon: <Network size={16} /> },
    { name: "Trumpstein", href: "/trumpstein", icon: <Brain size={16} /> },
    { name: "WTF?", href: "/wtf", icon: <Brain size={16} /> },
    { name: "Enigma", href: "/enigma", icon: <Fingerprint size={16} /> },
    {
      name: "WHOAMI?", href: "/donate", icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 14h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16" />
          <path d="m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9" />
          <path d="m2 15 6 6" />
          <path d="M19.5 8.5c.7-.7 1.5-1.6 1.5-2.7A2.83 2.83 0 0 0 16 3a2.8 2.8 0 0 0-2 1l-1.4 1.4" />
          <path d="m9.7 8.2-2.9-2.9a2.83 2.83 0 0 0-4 0 2.83 2.83 0 0 0 0 4l2.8 2.8" />
        </svg>
      )
    },
  ];

  const handleContactSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "contact", name: formData.get("name"), email: formData.get("email"), message: formData.get("message") }),
      });
      if (!response.ok) throw new Error("Email service rejected the message");
      alert("Message sent successfully!");
      setShowContact(false);
    } catch (error) {
      console.error("Error sending contact message:", error);
      alert("The message could not be sent. Please try again later.");
    }
  };

  return (
    <>
      {/* Compact Horizontal Navigation */}
      <motion.nav
        initial={reduceMotion ? false : { y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
        className="fixed top-3 left-1/2 -translate-x-1/2 z-50"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Glow effect */}
        <motion.div
          className="absolute inset-0 rounded-full blur-lg"
          style={{
            background: "linear-gradient(90deg, #f97316, #ef4444, #f97316)",
            backgroundSize: "200% 100%",
          }}
          animate={{
            backgroundPosition: !reduceMotion && isHovered ? ["0% 50%", "100% 50%", "0% 50%"] : "0% 50%",
            scale: !reduceMotion && isHovered ? 1.05 : 1,
            opacity: !reduceMotion && isHovered ? 0.5 : 0.25,
          }}
          transition={{
            backgroundPosition: reduceMotion ? { duration: 0 } : { duration: 3, repeat: Infinity, ease: "linear" },
            scale: { duration: reduceMotion ? 0 : 0.3 },
            opacity: { duration: reduceMotion ? 0 : 0.3 },
          }}
        />

        {/* Main compact container */}
        <motion.div
          className="relative flex items-center gap-0.5 px-2 py-1.5 rounded-full backdrop-blur-xl border border-orange-500/40"
          style={{
            background: "linear-gradient(135deg, rgba(0,0,0,0.9) 0%, rgba(20,8,0,0.95) 50%, rgba(0,0,0,0.9) 100%)",
            boxShadow: isHovered
              ? "0 0 30px rgba(249, 115, 22, 0.35), inset 0 1px 0 rgba(255,255,255,0.08)"
              : "0 0 15px rgba(249, 115, 22, 0.2), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
          animate={{
            borderColor: isHovered ? "rgba(249, 115, 22, 0.6)" : "rgba(249, 115, 22, 0.4)",
          }}
          transition={{ duration: 0.3 }}
        >
          {/* Logo + Brand */}
          <Link
            href="/"
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-full hover:bg-orange-500/10 transition-all duration-300 group"
          >
            <motion.div
              whileHover={reduceMotion ? undefined : { rotate: 360, scale: 1.1 }}
              transition={{ duration: reduceMotion ? 0 : 0.5 }}
              className="flex-shrink-0"
            >
              <Image
                src="/logos/trumpfiles_orange_logo.png"
                alt="Trumpstein Files"
                width={34}
                height={34}
                className="drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]"
                style={{ width: 'auto', height: 'auto' }}
              />
            </motion.div>
            <TrumpFilesBrand size="sm" static className="hidden sm:flex" />
          </Link>

          {/* Divider */}
          <div className="hidden md:block w-px h-6 bg-gradient-to-b from-transparent via-orange-500/50 to-transparent mx-3" />

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-0.5">
            {navItems.map((item, index) => (
              <motion.div
                key={item.name}
                initial="rest"
                animate="rest"
                whileHover={reduceMotion ? undefined : "hover"}
                whileFocus={reduceMotion ? undefined : "hover"}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              >
                <Link
                  href={item.href}
                  className={`relative flex min-h-11 items-center gap-1.5 rounded-md px-3 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${pathname === item.href
                    ? "text-orange-300"
                    : "text-foreground/70 hover:text-orange-200"
                    }`}
                >
                  {pathname === item.href && (
                    <motion.span
                      className="absolute inset-1 rounded-sm bg-orange-500/15"
                      layoutId="activeNavBg"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}

                  <span className={`relative z-10 ${pathname === item.href ? "text-orange-400" : "text-orange-400/50 group-hover:text-orange-400"}`}>
                    {item.icon}
                  </span>

                  <ArcticNavLabel label={item.name} />
                </Link>
              </motion.div>
            ))}
            <motion.div initial="rest" whileHover={reduceMotion ? undefined : "hover"} whileFocus={reduceMotion ? undefined : "hover"} whileTap={reduceMotion ? undefined : { scale: 0.97 }}>
              <Button
                variant="ghost"
                onClick={() => setShowContact(true)}
                className="min-h-11 rounded-md px-3 text-[13px] font-medium text-foreground/70 transition-colors duration-200 hover:bg-transparent hover:text-orange-200 focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                <Mail size={16} className="text-orange-400/50" />
                <ArcticNavLabel label="Contact" />
              </Button>
            </motion.div>
          </div>



          {/* Mobile menu button */}
          <motion.button
            className="ml-1 min-h-11 min-w-11 rounded-md p-2 text-orange-400 transition-colors hover:bg-orange-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
            onClick={() => setIsOpen(!isOpen)}
            whileTap={reduceMotion ? undefined : { scale: 0.9 }}
            type="button"
            aria-label={isOpen ? "Close site navigation" : "Open site navigation"}
            aria-expanded={isOpen}
            aria-controls="mobile-site-navigation"
          >
            <AnimatePresence mode="wait">
              {isOpen ? (
                <motion.div
                  key="close"
                  initial={reduceMotion ? false : { rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={reduceMotion ? { opacity: 0 } : { rotate: 90, opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2 }}
                >
                  <X size={20} />
                </motion.div>
              ) : (
                <motion.div
                  key="menu"
                  initial={reduceMotion ? false : { rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={reduceMotion ? { opacity: 0 } : { rotate: -90, opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2 }}
                >
                  <Menu size={20} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </motion.div>

        {/* Mobile Navigation Dropdown */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              id="mobile-site-navigation"
              initial={reduceMotion ? false : { opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 8, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
              className="absolute top-full left-1/2 -translate-x-1/2 w-56 rounded-xl overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(0,0,0,0.95) 0%, rgba(20,8,0,0.95) 100%)",
                boxShadow: "0 0 30px rgba(249, 115, 22, 0.25), inset 0 1px 0 rgba(255,255,255,0.08)",
                border: "1px solid rgba(249, 115, 22, 0.4)",
              }}
            >
              <div className="p-2 space-y-0.5">
                {navItems.map((item, index) => (
                  <motion.div
                    key={item.name}
                    initial={reduceMotion ? false : { opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: reduceMotion ? 0 : index * 0.05, duration: reduceMotion ? 0 : undefined }}
                  >
                    <Link
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${pathname === item.href
                        ? "bg-orange-500/15 text-orange-300"
                        : "text-foreground/70 hover:bg-orange-500/10 hover:text-orange-300"
                        }`}
                    >
                      <span className={pathname === item.href ? "text-orange-400" : "text-orange-400/50"}>
                        {item.icon}
                      </span>
                      <span className="text-sm" style={{ fontFamily: "var(--font-arctic-guardian-half)" }}>{item.name}</span>
                    </Link>
                  </motion.div>
                ))}

                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
                  <button
                    onClick={() => { setIsOpen(false); setShowContact(true); }}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-foreground/70 hover:bg-orange-500/10 hover:text-orange-300 transition-all duration-200 w-full"
                  >
                    <Mail size={16} className="text-orange-400/50" />
                    <span className="text-sm" style={{ fontFamily: "var(--font-arctic-guardian-half)" }}>Contact</span>
                  </button>
                </motion.div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      <Dialog open={showContact} onOpenChange={setShowContact}>
        <DialogContent className="sm:max-w-[425px] bg-black/95 border-orange-500/30">
          <DialogHeader>
            <DialogTitle className="text-orange-400">Contact Trumpstein Files</DialogTitle>
            <DialogDescription>Have information to share or found an error? Send it to the archive team.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleContactSubmit} className="space-y-4">
            <div><Label htmlFor="name">Name</Label><Input id="name" name="name" required className="bg-black/50 border-orange-500/30 focus:border-orange-500" /></div>
            <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required className="bg-black/50 border-orange-500/30 focus:border-orange-500" /></div>
            <div><Label htmlFor="message">Message</Label><Textarea id="message" name="message" required rows={4} className="bg-black/50 border-orange-500/30 focus:border-orange-500" /></div>
            <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white">Send Message</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
