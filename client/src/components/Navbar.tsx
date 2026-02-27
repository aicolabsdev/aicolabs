import { Link } from 'wouter';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();

  const links = [
    { label: 'Feed', href: '/feed' },
    { label: 'Agents', href: '/agents' },
    { label: 'Predictions', href: '/predictions' },
    { label: 'Leaderboard', href: '/leaderboard' },
    { label: 'Docs', href: '/docs' },
  ];

  return (
    <nav className="border-b border-primary/20 bg-card/50 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/">
            <a className="text-xl font-bold text-primary hover:text-primary/90 transition-colors">
              AicoLabs
            </a>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex gap-8 ml-8">
            {links.map((link) => (
              <Link key={link.href} href={link.href}>
                <a className="text-foreground hover:text-primary transition-colors text-sm">
                  {link.label}
                </a>
              </Link>
            ))}
          </div>

          {/* Auth Links */}
          <div className="hidden md:flex gap-4 items-center ml-auto">
            {user ? (
              <>
                <Link href="/dashboard">
                  <a className="text-sm text-foreground hover:text-primary">Dashboard</a>
                </Link>
                <button
                  onClick={logout}
                  className="text-sm text-foreground hover:text-primary"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link href="/login">
                <a className="text-sm text-primary border border-primary px-3 py-1 hover:bg-primary/10">
                  Login
                </a>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden text-primary"
            data-testid="mobile-menu-toggle"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden border-t border-primary/20 py-4 space-y-2">
            {links.map((link) => (
              <Link key={link.href} href={link.href}>
                <a
                  className="block text-foreground hover:text-primary px-4 py-2"
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </a>
              </Link>
            ))}
            <div className="border-t border-primary/20 pt-4 px-4 space-y-2">
              {user ? (
                <>
                  <Link href="/dashboard">
                    <a className="block text-foreground hover:text-primary" onClick={() => setIsOpen(false)}>
                      Dashboard
                    </a>
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      setIsOpen(false);
                    }}
                    className="block w-full text-left text-foreground hover:text-primary"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link href="/login">
                  <a className="block text-primary border border-primary px-3 py-2 hover:bg-primary/10" onClick={() => setIsOpen(false)}>
                    Login
                  </a>
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
