import type { GameEntry, OperatingSystem, PlatformDetails, PlatformLink } from '../types/catalog'

export const osChoices = [
  { id: 'all', label: 'Alles', blurb: 'Alle platforms' },
  { id: 'windows', label: 'Windows', blurb: 'Installers en zips' },
  { id: 'mac', label: 'macOS', blurb: 'Lokale bestanden' },
  { id: 'linux', label: 'Linux', blurb: 'Lokale bestanden' },
] as const

const download = (
  label: string,
  href: string,
  description: string,
): PlatformLink => ({
  label,
  href,
  kind: 'download',
  description,
})

const platform = (
  os: OperatingSystem,
  mode: PlatformDetails['mode'],
  summary: string,
  installSteps: string[],
  links: PlatformLink[],
  note?: string,
): PlatformDetails => ({
  os,
  mode,
  summary,
  note,
  installSteps,
  links,
})

export const games: GameEntry[] = [
  {
    slug: '0-a-d',
    title: '0 A.D.',
    genreLabel: 'Real-time strategy',
    highlight:
      'Bouw een oude beschaving op, verzamel grondstoffen en stuur grote legers het veld in.',
    descriptionNl:
      'Een historische real-time strategygame waarin je een nederzetting uitbouwt, grondstoffen verzamelt, technologie onderzoekt en legers inzet tegen andere spelers. Je speelt met oude beschavingen en probeert economisch en militair de overhand te krijgen.',
    setupNote:
      'De lokale collectie bevat een Windows-installer, een Linux AppImage en twee losse macOS-dmg\'s: een voor Intel en een voor Apple Silicon.',
    keywords: ['rts', 'strategy', 'ancient', 'base building', 'multiplayer'],
    accent: '#b97a36',
    platforms: [
      platform(
        'windows',
        'download',
        'Losse Windows-installer voor 64-bit systemen.',
        [
          'Download het exe-bestand en start de installer.',
          'Doorloop de setup en kies een map waar de game mag worden geinstalleerd.',
          'Start 0 A.D. daarna vanuit het startmenu of de installatiemap en stel je graphics en audio in.',
        ],
        [
          download(
            'Windows installer',
            '/downloads/0 a.d./Windows/0ad-0.28.0-win64.exe',
            'Lokale 64-bit Windows-installer van 0 A.D. 0.28.0',
          ),
        ],
      ),
      platform(
        'mac',
        'download',
        'Twee lokale macOS-dmg\'s: Apple Silicon en Intel.',
        [
          'Kies eerst de dmg die past bij jouw Mac: x86_64 voor Intel of aarch64 voor Apple Silicon.',
          'Open daarna de juiste dmg en sleep 0 A.D. naar Programma\'s of je eigen gamesmap.',
          'Start het spel vervolgens normaal op macOS en geef zo nodig toestemming in de beveiligingsinstellingen.',
        ],
        [
          download(
            'macOS Apple Silicon dmg',
            '/downloads/0 a.d./Mac-Silicon/0ad-0.28.0-macos-aarch64.dmg',
            'Lokale macOS-build voor Apple Silicon Macs',
          ),
          download(
            'macOS Intel dmg',
            '/downloads/0 a.d./Mac-intel/0ad-0.28.0-macos-x86_64.dmg',
            'Lokale macOS-build voor Intel Macs',
          ),
        ],
        'Gebruik de x86_64-build op Intel-Macs en de aarch64-build op Macs met een M-serie chip.',
      ),
      platform(
        'linux',
        'download',
        'Lokale Linux-build als AppImage.',
        [
          'Download het AppImage-bestand en maak het uitvoerbaar als jouw distributie dat vereist.',
          'Start daarna het AppImage direct vanuit je bestandsbeheer of terminal.',
          'Controleer bij de eerste start je resolutie, audio en multiplayer-instellingen.',
        ],
        [
          download(
            'Linux AppImage',
            '/downloads/0 a.d./Linux/0ad-0.28.0-x86_64.AppImage',
            'Lokale Linux AppImage van 0 A.D. 0.28.0',
          ),
        ],
      ),
    ],
  },
  {
    slug: 'among-us',
    title: 'Among Us',
    genreLabel: 'Social deduction / party',
    highlight: 'Korte rondes vol sabotage, paniek en discussies aan tafel of in voice.',
    descriptionNl:
      'Een online partygame waarin spelers samenwerken als Crewmates terwijl een of meer Impostors de groep proberen uit te schakelen. Je voert taken uit, meldt lichamen, bespreekt verdenkingen en stemt iemand weg.',
    setupNote:
      'De lokale collectie bevat een Windows-zip met het spel en een map met extra runtime-bestanden voor systemen die nog iets missen.',
    keywords: ['party', 'deduction', 'crewmates', 'impostors', 'lan'],
    accent: '#f4c542',
    platforms: [
      platform(
        'windows',
        'download',
        'Windows-bundel met het spel en meegeleverde redistributables.',
        [
          'Download de zip en pak hem volledig uit in een korte map, bijvoorbeeld C:/Games/AmongUs.',
          'Start daarna Among Us.exe uit de uitgepakte map.',
          'Mocht Windows nog onderdelen missen, installeer die dan vanuit de meegeleverde _Redist map.',
        ],
        [
          download(
            'Among Us zip',
            '/downloads/Among Us/Among.Us.v2024.3.5i.zip',
            'Complete Windows-zip met spelbestanden en _Redist map',
          ),
        ],
      ),
    ],
  },
  {
    slug: 'battlefield-1942',
    title: 'Battlefield 1942',
    genreLabel: 'First-person shooter',
    highlight: 'Grote WOII-gevechten met voertuigen, vlaggen en veel ruimte voor LAN-chaos.',
    descriptionNl:
      'Een WOII-shooter waarin spelers als soldaat vechten op grote slagvelden en controlepunten proberen te veroveren. Je gebruikt wapens en bestuurt ook voertuigen zoals tanks, vliegtuigen en schepen.',
    setupNote:
      'Het archief bevat niet alleen de game, maar ook extra drivers en runtime-pakketten voor oudere Windows-software.',
    keywords: ['shooter', 'ww2', 'battlefield', 'vehicles', 'multiplayer'],
    accent: '#c98c43',
    platforms: [
      platform(
        'windows',
        'download',
        'Een verzamel-zip met Battlefield 1942 en ondersteunende bestanden.',
        [
          'Download BF1942.zip en pak de inhoud volledig uit.',
          'Installeer daarna eerst de game vanuit het hoofdarchief in de bundel.',
          'Werkt de game niet direct, probeer dan de meegeleverde DirectX-, driver- of Visual C++-pakketten uit dezelfde map.',
        ],
        [
          download(
            'Battlefield 1942 bundel',
            '/downloads/Battlefield 1942/BF1942.zip',
            'Windows-zip met de game en extra ondersteunende installers',
          ),
        ],
      ),
    ],
  },
  {
    slug: 'hedgewars',
    title: 'Hedgewars',
    genreLabel: 'Turn-based artillery strategy',
    highlight: 'Beurtelings mikken, rare wapens inzetten en de hele map aan gort schieten.',
    descriptionNl:
      'Een beurtelings artilleriespel met humor, waarin teams van egels elkaar bevechten op vervormbare maps. Je kiest wapens, richt zorgvuldig en probeert het vijandige team uit te schakelen.',
    setupNote:
      'Voor Hedgewars staan op deze site zowel een Windows-installer als een lokale macOS-dmg klaar.',
    keywords: ['artillery', 'strategy', 'worms-like', 'turn-based', 'hedgehogs'],
    accent: '#7fe07f',
    platforms: [
      platform(
        'windows',
        'download',
        'Losse Windows-installer.',
        [
          'Download het exe-bestand en start de installer.',
          'Volg de setup tot Hedgewars volledig is geinstalleerd.',
          'Start het spel na installatie vanuit je snelkoppeling of de installatiemap.',
        ],
        [
          download(
            'Windows installer',
            '/downloads/Hedgewars/Windows/Hedgewars-1.0.0.exe',
            'Officiële Windows-installer uit de lokale collectie',
          ),
        ],
      ),
      platform(
        'mac',
        'download',
        'Losse macOS-dmg.',
        [
          'Download de dmg en open hem in Finder.',
          'Sleep Hedgewars naar Programma\'s of de map die jij gebruikt voor games.',
          'Open het spel daarna zoals je normaal een app op macOS start.',
        ],
        [
          download(
            'macOS dmg',
            '/downloads/Hedgewars/Mac/Hedgewars-1.0.0.dmg',
            'Lokale macOS-build van Hedgewars',
          ),
        ],
      ),
    ],
  },
  {
    slug: 'minecraft',
    title: 'Minecraft',
    genreLabel: 'Sandbox survival',
    highlight: 'Blokken, bouwen, survival en samen een wereld in die altijd groter kan worden.',
    descriptionNl:
      'Een sandboxspel waarin je in een blokkerige wereld grondstoffen verzamelt, bouwt, verkent en overleeft. Spelers maken gereedschap en bouwwerken, vechten tegen vijanden en kunnen ook creatief zonder beperkingen bouwen.',
    setupNote:
      'Deze collectie bevat losse launcherbestanden, een gedeelde instance-zip en op Windows ook een aparte Java-installer.',
    keywords: ['sandbox', 'survival', 'crafting', 'blocks', 'coop'],
    accent: '#6cc04a',
    platforms: [
      platform(
        'windows',
        'download',
        'Windows-pakket met PolyMC inclusief instance en een losse Java 21-installer.',
        [
          'Installeer eerst Java 21 via de MSI als die nog niet op je systeem staat.',
          'Download daarna PolyMC-met-instance.zip en pak alles uit in een map waar je mag schrijven.',
          'Lees de README.txt, die zich in de uitgepakte map bevindt.',
          'Start polymc.exe, controleer je Java-instellingen en open vervolgens de meegeleverde instance.',
        ],
        [
          download(
            'PolyMC met instance',
            '/downloads/Minecraft/Windows/PolyMC-met-instance.zip',
            'Windows-pakket met PolyMC en een kant-en-klare instance',
          ),
          download(
            'Java 21 MSI',
            '/downloads/Minecraft/Windows/OpenJDK21U-jdk_x64_windows_hotspot_21.0.10_7.msi',
            'Losse Java 21-installer voor Windows',
          ),
        ],
      ),
      platform(
        'mac',
        'download',
        'macOS-launcher, losse PolyMC-zip, gedeelde instance en de lokale README.',
        [
          'Download eerst een launcherbestand voor macOS en pak dat uit of open het in de vorm die jij wilt gebruiken.',
          'Gebruik daarna Minecraft-instance_linux-mac.zip om de gedeelde instance binnen te halen.',
          'Volgens README.txt hoort de inhoud van de instance map op macOS in ~/Library/Application Support/PolyMC/instances/.',
        ],
        [
          download(
            'PolyMC macOS tar.gz',
            '/downloads/Minecraft/Mac/PolyMC-macOS-7.0.tar.gz',
            'Portable macOS-archief van PolyMC',
          ),
          download(
            'Java installer for Mac',
            '/downloads/Minecraft/Mac/java.pkg',
            'Installer voor Java 25, nodig voor het opstarten van Minecraft'
          ),
          download(
            'PolyMC zip',
            '/downloads/Minecraft/Mac/PolyMC.zip',
            'Extra gecomprimeerde PolyMC-map voor macOS, voor het makkelijker installeren van de Minecraft instance',
          ),
          download(
            'Gedeelde instance zip',
            '/downloads/Minecraft/Minecraft-instance_linux-mac.zip',
            'Instance-pakket voor macOS en Linux',
          ),
          download(
            'README macOS',
            '/downloads/Minecraft/Mac/README.txt',
            'Lokale uitleg over waar de instance op macOS hoort',
          ),
        ],
        'README.txt zegt: verplaats de inhoud van de minecraft instance map naar ~/Library/Application Support/PolyMC/instances/.',
      ),
      platform(
        'linux',
        'download',
        'Portable Linux-launcher plus dezelfde gedeelde instance-zip als op macOS.',
        [
          'Download het Linux Portable-archief en pak het uit.',
          'Download daarna Minecraft-instance_linux-mac.zip en importeer of kopieer de instance in je launcher.',
          'Controleer voor het starten of je Java-versie overeenkomt met wat de instance nodig heeft.',
        ],
        [
          download(
            'PolyMC Linux Portable',
            '/downloads/Minecraft/Linux/PolyMC-Linux-Portable-7.0.tar.gz',
            'Portable Linux-archief van PolyMC',
          ),
          download(
            'Gedeelde instance zip',
            '/downloads/Minecraft/Minecraft-instance_linux-mac.zip',
            'Instance-pakket voor Linux en macOS',
          ),
        ],
      ),
    ],
  },
  {
    slug: 'openrct2',
    title: 'OpenRCT2',
    genreLabel: 'Theme park management sim',
    highlight: 'Bouw je park, laat achtbanen draaien en hou je bezoekers tevreden.',
    descriptionNl:
      'Een managementsim waarin je een pretpark bouwt en runt. Je plaatst attracties en paden, stelt prijzen in en probeert gasten tevreden te houden terwijl je park winst maakt.',
    setupNote:
      'Windows zit in een all-in-one zip; Linux en macOS gebruiken een losse OpenRCT2-build plus aparte RCT2-data.',
    keywords: ['management', 'sim', 'rollercoaster', 'park', 'building'],
    accent: '#5dc05d',
    platforms: [
      platform(
        'windows',
        'download',
        'Volledige Windows-bundel met installer, RCT2-iso en hulpmiddelen.',
        [
          'Download de Windows-zip en pak hem volledig uit.',
          'Volg te instructies uit de README.txt, die zich in de uitgepakte map bevindt.',
        ],
        [
          download(
            'Windows all-in-one zip',
            '/downloads/OpenRCT2/Windows/OpenRCT2-inclusief-rct2.zip',
            'Bundel met OpenRCT2-installer, RCT2-iso en hulpmiddelen',
          ),
        ],
      ),
      platform(
        'mac',
        'download',
        'macOS-build plus de gedeelde RCT2-data-zip.',
        [
          'Download eerst de macOS-build van OpenRCT2.',
          'Download daarnaast rct2.zip met de benodigde RollerCoaster Tycoon 2-data.',
          'Koppel daarna die data in OpenRCT2 zodat het spel volledig kan starten.',
        ],
        [
          download(
            'macOS build zip',
            '/downloads/OpenRCT2/Mac/OpenRCT2-v0.4.32-macos-universal.zip',
            'Lokale macOS-build van OpenRCT2',
          ),
          download(
            'RCT2 datafiles zip',
            '/downloads/OpenRCT2/Datafiles_linux-mac/rct2.zip',
            'Gedeelde datafiles voor macOS en Linux',
          ),
        ],
      ),
      platform(
        'linux',
        'download',
        'Linux AppImage plus dezelfde gedeelde RCT2-data-zip.',
        [
          'Download het AppImage-bestand en maak het uitvoerbaar als jouw systeem dat vereist.',
          'Download daarnaast rct2.zip met de benodigde RollerCoaster Tycoon 2-data.',
          'Wijs die data daarna toe in OpenRCT2 zodat de game echt kan draaien.',
        ],
        [
          download(
            'Linux AppImage',
            '/downloads/OpenRCT2/Linux/OpenRCT2-v0.4.32-linux-x86_64.AppImage',
            'Lokale Linux AppImage van OpenRCT2',
          ),
          download(
            'RCT2 datafiles zip',
            '/downloads/OpenRCT2/Datafiles_linux-mac/rct2.zip',
            'Gedeelde datafiles voor Linux en macOS',
          ),
        ],
      ),
    ],
  },
  {
    slug: 'openttd',
    title: 'OpenTTD',
    genreLabel: 'Transport management sim',
    highlight: 'Treinen, vrachtwagens en vliegroutes slim aan elkaar knopen voor een sterk netwerk.',
    descriptionNl:
      'Een transportsimulatie waarin je een netwerk bouwt met treinen, vrachtwagens, schepen en vliegtuigen. Je vervoert passagiers en goederen tussen steden en industrie om geld te verdienen en verder uit te breiden.',
    setupNote:
      'Alle drie de platforms hebben hier een eigen lokaal pakket. Let op: de Windows-build in deze map is ARM64.',
    keywords: ['transport', 'management', 'trains', 'sim', 'network'],
    accent: '#4ac6ff',
    platforms: [
      platform(
        'windows',
        'download',
        'Lokale installer voor Windows.',
        [
          'Controleer eerst of jouw Windows-systeem ARM64 gebruikt.',
          'Download installer en doorloop de setup.',
        ],
        [
          download(
            'Windows 64-bit installer',
            '/downloads/OpenTTD/Windows/openttd-15.2-windows-win64.exe',
            'OpenTTD 15.2 installer voor Windows',
          ),
        ],
      ),
      platform(
        'mac',
        'download',
        'Lokale macOS-dmg.',
        [
          'Download de dmg en open die op je Mac.',
          'Plaats OpenTTD waar jij je apps of games bewaart.',
          'Start het spel en laat het zo nodig de vrije basisbestanden aanvullen.',
        ],
        [
          download(
            'macOS dmg',
            '/downloads/OpenTTD/Mac/openttd-15.2-macos-universal.dmg',
            'Lokale macOS-build van OpenTTD 15.2',
          ),
        ],
      ),
      platform(
        'linux',
        'download',
        'Lokale Linux generic build als tar.xz.',
        [
          'Download het tar.xz-archief en pak het uit.',
          'Start OpenTTD vanuit de uitgepakte map.',
          'Voeg daarna extra graphics, geluid of muziek toe als je die wilt gebruiken.',
        ],
        [
          download(
            'Linux tar.xz',
            '/downloads/OpenTTD/Linux/openttd-15.2-linux-generic-amd64.tar.xz',
            'Lokale Linux generic build van OpenTTD 15.2',
          ),
        ],
      ),
    ],
  },
  {
    slug: 'trackmania-nations-forever',
    title: 'TrackMania Nations Forever',
    genreLabel: 'Arcade racing',
    highlight: 'Alles draait om snelheid, lijnen perfectioneren en rondetijden kapot maken.',
    descriptionNl:
      'Een snelle arcade-racer waarin je solo of online tijdritten rijdt op spectaculaire stuntbanen. Spelers proberen de perfecte lijn te vinden, records te verbeteren en desgewenst ook zelf tracks te bouwen.',
    setupNote:
      'De collectie bevat de hoofdinstaller en daarnaast nog een losse .NET 3.5-installer.',
    keywords: ['racing', 'arcade', 'time attack', 'stunts', 'trackmania'],
    accent: '#f8b132',
    platforms: [
      platform(
        'windows',
        'download',
        'Game-installer plus een losse .NET 3.5 setup.',
        [
          'Installeer .NET 3.5 als jouw systeem dat nog niet actief heeft.',
          'Start daarna tmnationsforever_setup.exe en rond de installatie af.',
          'Open het spel en stel daarna je resolutie, controls en profiel in.',
        ],
        [
          download(
            'TrackMania installer',
            '/downloads/Trackmania/tmnationsforever_setup.exe',
            'Hoofdinstaller van TrackMania Nations Forever',
          ),
          download(
            '.NET 3.5 installer',
            '/downloads/Trackmania/dotNetFx35setup.exe',
            'Losse .NET 3.5-installer uit de collectie',
          ),
        ],
      ),
    ],
  },
  {
    slug: 'unreal-tournament',
    title: 'Unreal Tournament',
    genreLabel: 'Arena first-person shooter',
    highlight: 'Razendsnelle arena-matches met futuristische wapens en pure reflexen.',
    descriptionNl:
      'Een arena-shooter waarin spelers in snelle matches tegen elkaar vechten met futuristische wapens. Je speelt modi zoals deathmatch en capture the flag en probeert tegenstanders zo vaak mogelijk uit te schakelen.',
    setupNote:
      'De lokale game-download is Windows-only. Voor andere systemen zit er alleen een txt-bestand in de collectie met een verwijzing voor later.',
    keywords: ['arena shooter', 'fps', 'deathmatch', 'capture the flag', 'ut'],
    accent: '#2455d0',
    platforms: [
      platform(
        'windows',
        'download',
        'Lokale Windows GOTY-installer.',
        [
          'Download UT_GOTY.exe en start de installer.',
          'Volg de setup en kies een map waar de game mag staan.',
          'Stel daarna video, audio en input in voordat je de eerste match start.',
        ],
        [
          download(
            'UT GOTY installer',
            '/downloads/Unreal tournament/UT_GOTY.exe',
            'Lokale Windows-installer van Unreal Tournament GOTY',
          ),
        ],
      ),
      platform(
        'mac',
        'info',
        'Er staat geen lokale macOS-build in de collectie, alleen een tekstbestand met een verwijzing voor later.',
        [
          'Download other-systems.txt als je de opgeslagen verwijzing wilt bewaren.',
          'Gebruik die informatie alleen buiten de offline LAN-omgeving.',
          'Op deze site zelf staat geen werkende macOS-download voor Unreal Tournament.',
        ],
        [
          download(
            'other-systems.txt',
            '/downloads/Unreal tournament/other-systems.txt',
            'Lokale tekstfile met een verwijzing voor andere systemen',
          ),
        ],
      ),
      platform(
        'linux',
        'info',
        'Ook voor Linux is alleen hetzelfde tekstbestand aanwezig, geen lokale gamebuild.',
        [
          'Download other-systems.txt als je de opgeslagen verwijzing wilt bewaren.',
          'Gebruik die informatie alleen buiten de offline LAN-omgeving.',
          'Op deze site zelf staat geen werkende Linux-download voor Unreal Tournament.',
        ],
        [
          download(
            'other-systems.txt',
            '/downloads/Unreal tournament/other-systems.txt',
            'Lokale tekstfile met een verwijzing voor andere systemen',
          ),
        ],
      ),
    ],
  },
  {
    slug: 'warsow',
    title: 'Warsow',
    genreLabel: 'Arena first-person shooter',
    highlight: 'Snelle movement, trickjumps en gevechten waar tempo alles bepaalt.',
    descriptionNl:
      'Een snelle arena-FPS met nadruk op beweging, trickjumps en competitieve gevechten. Spelers gebruiken geavanceerde movement om sneller wapens en power-ups te pakken en elkaar te overmeesteren.',
    setupNote:
      'Voor Warsow zijn in de collectie drie lokale builds aanwezig: Windows, macOS en Linux.',
    keywords: ['arena', 'movement', 'fps', 'trickjump', 'warsow'],
    accent: '#2c7db9',
    platforms: [
      platform(
        'windows',
        'download',
        'Lokale Windows-setup.',
        [
          'Download de Windows-setup en doorloop de installer.',
          'Laat de gamebestanden op een vaste plek neerzetten.',
          'Start Warsow daarna en stel beeld, audio en controls in.',
        ],
        [
          download(
            'Windows setup',
            '/downloads/Warsow/Windows/warsow-2.1.2-setup.exe',
            'Lokale Windows-setup van Warsow 2.1.2',
          ),
        ],
      ),
      platform(
        'mac',
        'download',
        'Lokale macOS-dmg.',
        [
          'Download de dmg en open hem op macOS.',
          'Plaats Warsow in de map waar jij je apps bewaart.',
          'Start het spel daarna normaal vanuit Finder of Launchpad.',
        ],
        [
          download(
            'macOS dmg',
            '/downloads/Warsow/Mac/warsow-2.1.2.dmg',
            'Lokale macOS-build van Warsow 2.1.2',
          ),
        ],
      ),
      platform(
        'linux',
        'download',
        'Lokale Linux-build als tar.gz.',
        [
          'Download het tar.gz-archief en pak het uit.',
          'Open daarna de Warsow-map en start de juiste binary.',
          'Pas zo nodig bestandsrechten aan voordat je de game start.',
        ],
        [
          download(
            'Linux tar.gz',
            '/downloads/Warsow/Linux/warsow-2.1.2.tar.gz',
            'Lokale Linux-build van Warsow 2.1.2',
          ),
        ],
      ),
    ],
  },
]
