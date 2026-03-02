export default function ProfilePreviewPage() {
  const gallery = [
    "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80",
  ];

  return (
    <main className="mx-auto min-h-screen w-full max-w-md space-y-5 px-4 pb-36 pt-4 text-white">
      <section className="relative overflow-hidden rounded-[30px] border border-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.42)]">
        <div className="relative aspect-[4/5]">
          <img src={gallery[0]} alt="Hero" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#14071f]/90 via-[#14071f]/35 to-transparent" />

          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
            <span className="rounded-full border border-emerald-300/40 bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-100 backdrop-blur-md">
              Disponible ahora
            </span>
            <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-md">
              ★ 4.9
            </span>
          </div>

          <div className="absolute inset-x-0 bottom-0 p-4">
            <div className="rounded-3xl border border-white/20 bg-white/10 p-4 backdrop-blur-xl">
              <h1 className="text-3xl font-semibold tracking-tight">Valentina, 27</h1>
              <p className="mt-1 text-sm tracking-wide text-white/80">Las Condes • Elite companion</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {['Elegante', 'Discreta', 'Bilingüe'].map((tag) => (
                  <span key={tag} className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.06] p-5 backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Galería</h2>
          <span className="text-xs text-white/70">4 fotos</span>
        </div>
        <div className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {gallery.map((img, i) => (
            <div key={img} className="aspect-[4/5] w-[44vw] min-w-[150px] max-w-[210px] snap-start overflow-hidden rounded-3xl border border-white/10">
              <img src={img} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.06] p-5 backdrop-blur-xl">
        <h2 className="mb-3 text-lg font-semibold">Información</h2>
        <div className="flex flex-wrap gap-2">
          {['168 cm', 'Español/Inglés', 'Estilo sofisticado', 'Atención premium'].map((item) => (
            <span key={item} className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white/90">
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-fuchsia-300/20 bg-gradient-to-br from-[#24122f]/95 via-[#2d1738]/85 to-[#1a1025]/80 p-5 backdrop-blur-xl">
        <h2 className="text-lg font-semibold">Tarifa</h2>
        <p className="mt-1 text-4xl font-semibold">$120.000</p>
        <p className="text-sm text-white/70">60 minutos</p>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[linear-gradient(180deg,rgba(14,7,22,0.75)_0%,rgba(12,6,20,0.96)_40%,rgba(12,6,20,0.98)_100%)] px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-2.5">
          <button className="rounded-2xl bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400 py-3 text-sm font-semibold">Enviar mensaje</button>
          <button className="rounded-2xl border border-white/25 bg-white/5 py-3 text-sm font-medium">Solicitar servicio</button>
        </div>
      </div>
    </main>
  );
}
