import { Link } from 'react-router-dom'
import { PlatformDetail } from '../components/PlatformDetail'
import type { PlatformDetails, PlatformLink } from '../types/catalog'

const contactEmail = 'jeroenkool@jancampertgroep.nl'
const obsBase = '/downloads/OBS Studio'

const download = (label: string, href: string, description: string): PlatformLink => ({
  label,
  href,
  kind: 'download',
  description,
})

const obsPlatforms: PlatformDetails[] = [
  {
    os: 'windows',
    mode: 'download',
    summary: 'OBS Studio 33.0.1 installer voor 64-bit Windows.',
    installSteps: [
      'Download de installer en start het exe-bestand.',
      'Klik door de setup en start OBS Studio na afloop.',
      'Kies bij de eerste start in de wizard voor "Alleen opnemen".',
    ],
    links: [
      download(
        'Windows installer',
        `${obsBase}/Windows/OBS-Studio-33.0.1-Windows-x64-Installer.exe`,
        'OBS Studio 33.0.1 voor Windows (x64)',
      ),
    ],
  },
  {
    os: 'mac',
    mode: 'download',
    summary: 'Twee dmg\'s: een voor Apple Silicon en een voor Intel.',
    note: 'Kies Apple Silicon voor een Mac met M-chip, Intel voor oudere Macs. Twijfel je? Kijk in het Apple-menu bij Over deze Mac.',
    installSteps: [
      'Open de juiste dmg en sleep OBS naar Programma\'s.',
      'Start OBS en geef toestemming voor schermopname en microfoon in Systeeminstellingen > Privacy en beveiliging.',
      'Herstart OBS nadat je de toestemming hebt gegeven.',
    ],
    links: [
      download(
        'macOS Apple Silicon dmg',
        `${obsBase}/Mac-Silicon/OBS-Studio-33.0.1-macOS-Apple.dmg`,
        'Voor Macs met een M-serie chip',
      ),
      download(
        'macOS Intel dmg',
        `${obsBase}/Mac-intel/OBS-Studio-33.0.1-macOS-Intel.dmg`,
        'Voor Macs met een Intel-processor',
      ),
    ],
  },
  {
    os: 'linux',
    mode: 'download',
    summary: 'Een .deb voor Ubuntu/Debian en een Flatpak-bundel voor andere distributies.',
    note: 'Zonder internet heb je bij de Flatpak ook de runtime-bundel nodig. Installeer die als eerste.',
    installSteps: [
      'Ubuntu/Debian: sudo apt install ./OBS-Studio-33.0.1-Ubuntu-26.04-x86_64.deb',
      'Andere distributies: flatpak install --user ./org.freedesktop.Platform-26.08-runtime.flatpak',
      'Daarna: flatpak install --user ./obs-studio.flatpak en start OBS via je app-menu.',
    ],
    links: [
      download(
        'Ubuntu/Debian .deb',
        `${obsBase}/Linux/OBS-Studio-33.0.1-Ubuntu-26.04-x86_64.deb`,
        'Officieel pakket, gebouwd voor Ubuntu 26.04',
      ),
      download(
        'Flatpak-bundel',
        `${obsBase}/Linux/obs-studio.flatpak`,
        'OBS Studio als Flatpak voor elke distributie',
      ),
      download(
        'Flatpak-runtime',
        `${obsBase}/Linux/org.freedesktop.Platform-26.08-runtime.flatpak`,
        'Runtime die de Flatpak nodig heeft als je geen internet hebt',
      ),
    ],
  },
]

const recordingSteps = [
  'Installeer OBS Studio met een van de bestanden hieronder.',
  'Klik onder "Bronnen" op + en kies "Schermopname" (macOS: "macOS-schermopname", Linux: "Schermopname (PipeWire)").',
  'Neem op in 1920×1080 als mp4. Geluid is niet nodig, want de video heeft geen geluid.',
  'Sluit vooraf alles wat niet in beeld hoort: privé-tabbladen, chats en meldingen.',
  'Klik op "Opname starten" en laat alles zien: van de downloadpagina tot en met het hoofdmenu van het spel.',
  'Doe alles rustig en wacht na elke klik ongeveer 1 seconde. Wachten en laden is geen probleem, dat wordt versneld.',
  'Ging er iets mis of nam je een omweg? Neem dan liever opnieuw op.',
  'Klik op "Opname stoppen". Je vindt het bestand via Bestand > Opnames weergeven.',
]

const mailSubject = 'Opname instructievideo LAN-party'
const mailBody = [
  'Hoi Jeroen,',
  '',
  'Spel:',
  'Besturingssysteem (Windows / macOS Intel / macOS Apple Silicon / Linux):',
  'Gebruikte downloadknop(pen) op de site:',
  'Extra tools nodig (bijv. 7-Zip, of: niets):',
  'Bijzonderheden (meldingen, gekozen opties en waarom):',
  'Link naar de opname (bijv. WeTransfer):',
  '',
].join('\n')
const mailHref = `mailto:${contactEmail}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`

export function RecordVideoPage() {
  return (
    <div className="page-stack">
      <section className="detail-hero">
        <Link className="back-link" to="/">
          Terug naar overzicht
        </Link>

        <p className="section-kicker">Meehelpen</p>
        <h1>Kan een instructievideo beter?</h1>
        <p className="detail-hero__lead">
          Vind je een video onduidelijk, mist er een video voor jouw systeem of weet je
          een handigere manier? Neem dan zelf de installatie op met OBS Studio en stuur
          de opname op. Meer hoef je niet te doen: ik maak er een instructievideo in
          dezelfde stijl van en zet die op de site.
        </p>

        <div className="detail-hero__actions">
          <a className="button" href="#obs-downloads">
            Download OBS Studio
          </a>
          <a className="button button--ghost" href={mailHref}>
            Opname mailen
          </a>
        </div>
      </section>

      <section className="detail-grid">
        <article className="surface-panel surface-panel--compact">
          <p className="section-kicker">Stap 1</p>
          <h2>Opnemen met OBS Studio</h2>
          <ol className="step-list">
            {recordingSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </article>

        <article className="surface-panel surface-panel--compact">
          <p className="section-kicker">Stap 2</p>
          <h2>Opsturen</h2>
          <p>
            Stuur een mail naar <a href={mailHref}>{contactEmail}</a> en vertel daarin:
          </p>
          <ul className="step-list">
            <li>om welk spel het gaat;</li>
            <li>op welk systeem je het hebt opgenomen (Windows, macOS Intel, macOS Apple Silicon of Linux);</li>
            <li>welke downloadknop(pen) op de site je hebt gebruikt;</li>
            <li>of je extra tools nodig had, bijvoorbeeld 7-Zip;</li>
            <li>bijzonderheden: een melding die je wegklikt, een optie die je kiest, en waarom.</li>
          </ul>
          <p>
            Wat al duidelijk in de opname te zien is, hoef je niet te beschrijven.
          </p>
          <p>
            Is de opname te groot om te mailen? Stuur hem dan via een dienst als
            WeTransfer en zet de link in je mail.
          </p>
        </article>
      </section>

      <section className="surface-panel" id="obs-downloads">
        <div className="surface-panel__header">
          <div>
            <p className="section-kicker">Downloads</p>
            <h2>OBS Studio per platform</h2>
          </div>
        </div>

        <div className="platform-grid">
          {obsPlatforms.map((platform) => (
            <PlatformDetail key={platform.os} platform={platform} />
          ))}
        </div>
      </section>
    </div>
  )
}
