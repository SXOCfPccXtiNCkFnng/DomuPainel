import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-md max-w-md w-full space-y-4">
        <span className="text-4xl font-black text-domu-blue">404</span>
        <h2 className="text-lg font-black text-slate-900">Página Não Encontrada</h2>
        <p className="text-xs text-slate-500">
          A página que você está procurando não existe ou foi movida.
        </p>
        <Link
          href="/"
          className="inline-block btn-domu-primary text-xs py-2 px-4 shadow-sm"
        >
          Voltar ao Inicio
        </Link>
      </div>
    </div>
  );
}
