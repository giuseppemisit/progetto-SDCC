// ==============================================================================
// src/app/app.component.ts — Shell Applicativa e Gestore del Layout Globale
// ==============================================================================

import { toSignal } from '@angular/core/rxjs-interop';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { NavbarComponent } from './components/navbar/navbar.component';

// ─── CONTRATTO DEI METADATI DI ROTTA ──────────────────────────────────────────
// Struttura dei metadati che ogni rotta passa al layout, con controllo
// dei tipi in fase di compilazione
interface DatiRotta {
  heading: string;
  sezione: string;
}

// ─── COMPONENTE ROOT ──────────────────────────────────────────────────────────
// Standalone: dichiara le proprie dipendenze senza bisogno di un NgModule
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, NavbarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {

  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);

  readonly mobileNavOpen = signal(false);

  readonly datiRotta = toSignal(
    this.router.events.pipe(
      filter((evento) => evento instanceof NavigationEnd),
      map(() => this.leggiDatiRottaCorrente()),
      startWith(this.leggiDatiRottaCorrente()),
    ),
    { initialValue: { heading: 'Panoramica', sezione: 'Dashboard' } },
  );

  toggleMobileNav(): void {
    this.mobileNavOpen.update((aperto) => !aperto);
  }

  closeMobileNav(): void {
    this.mobileNavOpen.set(false);
  }

  private leggiDatiRottaCorrente(): DatiRotta {
    let rotta = this.activatedRoute.root;
    while (rotta.firstChild) {
      rotta = rotta.firstChild;
    }
    const dati = rotta.snapshot.data;
    return { heading: dati['heading'] ?? '', sezione: dati['sezione'] ?? '' };
  }

}
