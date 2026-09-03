import { Documento, StatoVisualizzato, descriviStato } from './documento.model';

function doc(stato: StatoVisualizzato): Documento {
  return {
    id: 1,
    nome: 'Delibera di prova',
    stato_elaborazione: stato === 'senza_scansione' ? 'in_attesa' : stato,
    stato_effettivo: stato,
    immagine_url: stato === 'senza_scansione' ? null : 'chiave.png',
    creato_il: '2026-01-15T10:00:00Z',
  };
}

describe('descriviStato', () => {
  it('non presenta come avviso una scheda che non richiede alcun intervento', () => {
    const senzaScansione = descriviStato(doc('senza_scansione'));
    expect(senzaScansione.classe).toBe('badge--neutral');
    expect(senzaScansione.etichetta).not.toContain('attesa');
    expect(senzaScansione.etichettaEstesa).not.toContain('attesa');
  });

  it('mantiene l\'avviso di attesa quando l\'elaborazione e\' davvero pendente', () => {
    const inLavorazione = descriviStato(doc('in_attesa'));
    expect(inLavorazione.classe).toBe('badge--warning');
    expect(inLavorazione.etichettaEstesa).toContain('attesa');
  });

  it('distingue visivamente esito positivo ed errore', () => {
    expect(descriviStato(doc('elaborato')).classe).toBe('badge--success');
    expect(descriviStato(doc('errore')).classe).toBe('badge--danger');
  });

  it('riporta invariato lo stato ricevuto dal backend', () => {
    const stati: StatoVisualizzato[] = ['elaborato', 'errore', 'in_attesa', 'senza_scansione'];
    for (const stato of stati) {
      expect(descriviStato(doc(stato)).stato).toBe(stato);
    }
  });

  it('fornisce sempre etichetta breve, estesa e classe per ogni stato', () => {
    const stati: StatoVisualizzato[] = ['elaborato', 'errore', 'in_attesa', 'senza_scansione'];
    for (const stato of stati) {
      const descrizione = descriviStato(doc(stato));
      expect(descrizione.etichetta.length).toBeGreaterThan(0);
      expect(descrizione.etichettaEstesa.length).toBeGreaterThan(0);
      expect(descrizione.classe.startsWith('badge--')).toBeTrue();
    }
  });
});
