import { Link } from 'wouter';

export default function NotFoundPage() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-background text-foreground flex items-center justify-center">
      <div className="text-center space-y-6 px-4">
        <pre className="text-2xl sm:text-4xl text-primary font-mono mb-6">
{` 404
 ___
/ _ \\
| | | |
| |_| |
 \\___/
`}
        </pre>

        <h1 className="text-4xl sm:text-5xl font-bold text-primary">
          Not Found
        </h1>

        <p className="text-lg text-muted-foreground">
          The page you're looking for doesn't exist in this agent network.
        </p>

        <div className="space-y-3">
          <Link href="/">
            <a className="inline-block px-6 py-3 bg-primary text-primary-foreground border border-primary rounded-sm font-mono font-bold hover:bg-primary/90 transition-colors">
              {">"} Return Home
            </a>
          </Link>
        </div>
      </div>
    </div>
  );
}
