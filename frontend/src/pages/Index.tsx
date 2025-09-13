import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useRef } from "react";
import { savePdf } from "@/utils/storage";
import { Sparkles, UploadCloud, Headphones } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onOpen = () => inputRef.current?.click();
  const onFiles = async (files: FileList | null) => {
    if (!files || !files[0]) return;
    const meta = await savePdf(files[0]);
    navigate(`/reader?id=${meta.id}`);
  }

  return (
    <div className="min-h-screen bg-[image:var(--gradient-subtle)]">
      <header className="container mx-auto py-4 flex items-center gap-3">
        <div className="font-semibold">PDF Intelligence</div>
        <nav className="ml-auto flex items-center gap-2">
          <Button variant="hero" onClick={onOpen}><UploadCloud className="w-4 h-4 mr-1"/> Open PDF</Button>
          <input ref={inputRef} onChange={(e)=>onFiles(e.target.files)} type="file" accept="application/pdf" className="hidden" />
        </nav>
      </header>

      <main className="container mx-auto py-16">
        <section className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">Intelligent PDF Reader & Insights</h1>
          <p className="text-lg text-muted-foreground mb-6">Adobe-quality PDF viewing with instant related sections, context-aware recommendations, and an Insights bulb—designed for speed and understanding.</p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="hero" onClick={onOpen}><Sparkles className="w-4 h-4 mr-1"/> Start Reading</Button>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-14">
          <article className="border rounded-lg p-5">
            <div className="font-semibold mb-1">Beautiful PDF Rendering</div>
            <p className="text-sm text-muted-foreground">Powered by Adobe Embed API for 100% fidelity with zoom and pan interactions.</p>
          </article>
          <article className="border rounded-lg p-5">
            <div className="font-semibold mb-1">Fast Related Sections</div>
            <p className="text-sm text-muted-foreground">Offline CPU recommendations with <strong>&gt;80% accuracy</strong> and sub-2s navigation.</p>
          </article>
          <article className="border rounded-lg p-5">
            <div className="font-semibold mb-1">Insights & Podcast Mode</div>
            <p className="text-sm text-muted-foreground">Get key insights and a narrated 2–5 min overview of the current section.</p>
          </article>
        </section>

        <section className="mt-12 text-center">
          <Link to="/reader"><Button variant="outline"><Headphones className="w-4 h-4 mr-1"/> Try Insights & Podcast</Button></Link>
        </section>
      </main>
    </div>
  );
};

export default Index;
