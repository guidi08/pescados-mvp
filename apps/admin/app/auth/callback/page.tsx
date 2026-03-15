'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

function CallbackContent() {
  const params = useSearchParams();

  useEffect(() => {
    const qp = params.toString();
    const deepLink = `lotepro://auth/callback?${qp}`;
    window.location.href = deepLink;
  }, [params]);

  return (
    <div style={{ padding: 32, fontFamily: 'sans-serif' }}>
      <h1>Confirmando e-mail…</h1>
      <p>Se o app não abrir automaticamente, clique no botão abaixo.</p>
      <a
        href={`lotepro://auth/callback?${params.toString()}`}
        style={{ display: 'inline-block', padding: '10px 16px', background: '#111', color: '#fff', borderRadius: 8 }}
      >
        Abrir LotePro
      </a>
      <p style={{ marginTop: 16, color: '#666' }}>
        Caso esteja no computador, abra o app no celular e tente novamente.
      </p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32, fontFamily: 'sans-serif' }}><h1>Carregando…</h1></div>}>
      <CallbackContent />
    </Suspense>
  );
}
