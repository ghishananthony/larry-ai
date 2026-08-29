import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";

export function LarryMark({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "size-6" : "size-8";
  const glyph = size === "sm" ? "text-sm" : "text-xl";
  const word = size === "sm" ? "text-lg" : "text-2xl";
  return (
    <span className="flex items-center gap-2">
      <span className={`${box} bg-primary rounded-sm flex items-center justify-center`}>
        <span className={`text-accent font-serif font-bold ${glyph}`}>L</span>
      </span>
      <span className={`font-serif ${word} font-bold tracking-tight`}>Larry</span>
    </span>
  );
}

export function SiteNav() {
  const { session, loading } = useAuth();
  return (
    <nav className="flex items-center justify-between px-8 py-6 border-b border-border">
      <Link to="/">
        <LarryMark />
      </Link>
      <div className="hidden md:flex items-center gap-8 text-sm font-medium">
        <Link to="/widget" className="hover:text-accent transition-colors">
          Student Widget
        </Link>
        <Link to="/admin" className="hover:text-accent transition-colors">
          Admin Console
        </Link>
        <a href="#integrity" className="hover:text-accent transition-colors">
          Integrity Policy
        </a>
        {!loading && session ? (
          <Link
            to="/profile"
            className="bg-primary text-primary-foreground px-5 py-2 rounded-full hover:bg-primary/90 transition-all"
          >
            Your account
          </Link>
        ) : (
          <Link
            to="/auth"
            className="bg-primary text-primary-foreground px-5 py-2 rounded-full hover:bg-primary/90 transition-all"
          >
            Student sign in
          </Link>
        )}
      </div>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border py-12">
      <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-8">
        <LarryMark size="sm" />
        <p className="text-sm text-muted-foreground">
          © 2026 Larry AI Academic Platforms. Empowering libraries, respecting scholarship.
        </p>
        <div className="flex gap-6 text-sm font-medium text-muted-foreground">
          <a href="#integrity">Integrity</a>
          <a href="#integrity">Privacy</a>
          <a href="#integrity">Compliance</a>
        </div>
      </div>
    </footer>
  );
}
