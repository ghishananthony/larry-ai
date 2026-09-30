import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useInstitutionAccess } from "@/hooks/useInstitutionAccess";

export function LarryMark({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "size-7" : "size-11";
  const glyph = size === "sm" ? "text-base" : "text-2xl";
  const word = size === "sm" ? "text-lg" : "text-4xl";
  return (
    <span className="flex items-center gap-2.5">
      <span
        className={`${box} relative bg-accent rounded-md flex items-center justify-center shadow-sm`}
      >
        <span className="absolute inset-[3px] rounded-[4px] border border-accent-foreground/40" />
        <span className={`relative text-accent-foreground font-serif font-semibold ${glyph} leading-none`}>
          L
        </span>
      </span>
      <span className={`font-serif ${word} font-semibold tracking-tight`}>Larry</span>
    </span>
  );
}

export function SiteNav() {
  const { session, loading } = useAuth();
  const access = useInstitutionAccess();
  return (
    <nav className="border-b border-border">
      <div className="max-w-[1320px] mx-auto flex items-center justify-between px-8 py-5">
      <Link to="/">
        <LarryMark />
      </Link>
      <div className="hidden md:flex items-center gap-8 font-serif text-[15px]">
        <Link to="/widget" className="hover:text-accent transition-colors">
          Student Widget
        </Link>
        {access.data?.isAdmin && (
          <Link to="/admin" className="hover:text-accent transition-colors">
            Admin Console
          </Link>
        )}
        <a href="#integrity" className="hover:text-accent transition-colors">
          Integrity Policy
        </a>
        {!loading && session ? (
          <Link
            to="/profile"
            className="bg-primary text-primary-foreground px-5 py-2 rounded-full font-sans font-semibold text-sm hover:bg-primary/90 transition-all"
          >
            Your account
          </Link>
        ) : (
          <Link
            to="/auth"
            className="bg-accent text-accent-foreground px-5 py-2 rounded-full font-sans font-semibold text-sm hover:bg-accent/90 transition-all"
          >
            Student sign in
          </Link>
        )}
      </div>
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
