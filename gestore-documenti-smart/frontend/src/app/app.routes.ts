import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { DocumentoListaComponent } from './components/documento-lista/documento-lista.component';
import { DocumentoFormComponent } from './components/documento-form/documento-form.component';
import { DocumentoDettaglioComponent } from './components/documento-dettaglio/documento-dettaglio.component';
import { UploadMassivoComponent } from './components/upload-massivo/upload-massivo.component';
import { RicercaComponent } from './components/ricerca/ricerca.component';
import { RicercaImmagineComponent } from './components/ricerca-immagine/ricerca-immagine.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'documenti', component: DocumentoListaComponent },
  { path: 'documenti/nuovo', component: DocumentoFormComponent },
  { path: 'documenti/:id', component: DocumentoDettaglioComponent },
  { path: 'documenti/:id/modifica', component: DocumentoFormComponent },
  { path: 'upload', component: UploadMassivoComponent },
  { path: 'ricerca', component: RicercaComponent },
  { path: 'ricerca/immagine', component: RicercaImmagineComponent }
];
