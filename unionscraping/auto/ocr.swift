// ocr.swift — OCR locale per auto_from_screenshots.py
//
// Usa il framework Vision di macOS (nessuna dipendenza da installare, nessun
// servizio esterno): legge una o piu' immagini e stampa una riga TSV per ogni
// blocco di testo riconosciuto:
//
//     minX <TAB> minY <TAB> width <TAB> height <TAB> testo
//
// Le coordinate sono normalizzate 0..1 e hanno l'origine in BASSO a sinistra
// (convenzione di Vision): auto_from_screenshots.py le usa per raggruppare i
// blocchi in righe di classifica.
//
// Compilazione (automatica, la fa lo script Python al primo utilizzo):
//     swiftc -O -module-cache-path <cache> ocr.swift -o <cache>/ocr

import Foundation
import Vision
import AppKit

let args = CommandLine.arguments
if args.count < 2 {
    FileHandle.standardError.write("uso: ocr <immagine> [immagine...]\n".data(using: .utf8)!)
    exit(2)
}

var failed = false
for path in args.dropFirst() {
    guard let image = NSImage(contentsOfFile: path),
          let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        FileHandle.standardError.write("impossibile leggere \(path)\n".data(using: .utf8)!)
        failed = true
        continue
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["en-US", "it-IT"]
    // Le classifiche contengono soprannomi e sigle: la correzione linguistica
    // "inventerebbe" parole e peggiorerebbe i nomi dei piloti.
    request.usesLanguageCorrection = false
    request.minimumTextHeight = 0.005

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    do {
        try handler.perform([request])
    } catch {
        FileHandle.standardError.write("errore OCR \(path): \(error)\n".data(using: .utf8)!)
        failed = true
        continue
    }

    print("=== \(path)")
    let observations = (request.results ?? []) as! [VNRecognizedTextObservation]
    for observation in observations {
        guard let candidate = observation.topCandidates(1).first else { continue }
        let box = observation.boundingBox
        print(String(format: "%.5f\t%.5f\t%.5f\t%.5f\t%@",
                     box.minX, box.minY, box.width, box.height,
                     candidate.string))
    }
}

exit(failed ? 1 : 0)
