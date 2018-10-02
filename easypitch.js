const EasyPitch = (() => {

	window.AudioContext = window.AudioContext || window.webkitAudioContext;
	let context = new AudioContext();

	function lognormal(x) {
		return 1/Math.sqrt(2*Math.PI) * Math.pow(Math.E, -1/2*Math.pow(Math.log(x), 2));
	}

	class Instrument {
		constructor(waveformFunc) {
			this.waveformFunc = waveformFunc;
		}

		playNote(note, bpm, callback) {
			let secondsPerWholeNote = 60 / bpm;
			let seconds = secondsPerWholeNote * note.fraction;
			playNote(this.waveformFunc, note.name, note.octave, seconds);
			setTimeout(callback, 1000*seconds);
		}

		playNotes(notes, bpm, callback) {
			let thisInstrument = this;
			let i = 0;
			function nextNote() {
				if (i < notes.length) {
					thisInstrument.playNote(notes[i++], bpm, nextNote);
				}
				else {
					callback();
				}
			};
			nextNote();	
		}
	}

	class SimpleInstrument extends Instrument {
		constructor(overtones) {
			let overtoneSum = overtones.reduce((a, b) => a+b);
			super((t, freq) => {
				let sample = 0;
				for (let i = 0; i < overtones.length; i++) {
					let overtoneFreq = freq*(i+1);
					let wave = Math.sin(2*Math.PI*overtoneFreq*t);
					let amplitude = overtones[i] * lognormal(50*t);
					sample += amplitude*wave;
				}
				return sample / overtoneSum;
			});
		}
	}

	function playFreq(waveformFunc, freq, time) {
		let source = context.createBufferSource(); // creates a sound source
		let buffer = context.createBuffer(2, context.sampleRate*time, context.sampleRate);
		for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
			var nowBuffering = buffer.getChannelData(channel);
			for (let i = 0; i < nowBuffering.length; i++) {
				nowBuffering[i] = waveformFunc(i/context.sampleRate, freq);
			}
		}
		source.buffer = buffer;                    // tell the source which sound to play
		source.connect(context.destination);       // connect the source to the context's destination (the speakers)
		source.start(0); 
	}

	/*
		Octave 8
	*/
	let noteFreqs = {
		"C": 4186.01,
		"C#": 4434.92,
		"Db": 4434.92,
		"D": 4698.63,
		"D#": 4978.03,
		"Eb": 4978.03,
		"E": 5274.04,
		"F": 5587.65,
		"F#": 5919.91,
		"Gb": 5919.91,
		"G": 6271.93,
		"G#": 6644.88,
		"Ab": 6644.88,
		"A": 7040.00,
		"A#": 7458.62,
		"Bb": 7458.62,
		"B": 7902.13
	};

	function playNote(waveformFunc, noteName, noteOctave, time) {
		let octaveScale = Math.pow(2, noteOctave - 8);
		let freq = octaveScale*noteFreqs[noteName];
		playFreq(waveformFunc, freq, time);
	}

	class Note {
		constructor(name, octave, fraction) { // fraction is 1, 1/2, 1/4, 1/8, etc.
			this.name = name;
			this.octave = octave;
			this.fraction = fraction;
		}
	}

	function playNotes(notes, bpm) {
		let i = 0;
		function nextNote() {
			if (i < notes.length) {
				notes[i++].play(bpm, nextNote);
			}
		};
		nextNote();
	}

	function init() {
		let inst = new SimpleInstrument([1, 0, 0, 1/4]);
		inst.playNotes([
			new Note("A", 4, 1/4),
			new Note("A", -10, 1/4),
			new Note("A", -10, 1/2),
			new Note("A", -10, 1/4),
			new Note("E", 4, 1/4),
			new Note("A", -10, 1/4),
			new Note("D", 4, 1/4),
			new Note("A", -10, 1/4),
			new Note("Db", 4, 1),
			new Note("A", -10, 1/2),
			new Note("Db", 4, 1/4),
			new Note("A", -10, 1/4),
			new Note("D", 4, 1/4),
			new Note("A", -10, 1/4),
			new Note("E", 4, 1/4),
			new Note("A", -10, 1/4),
			new Note("F#", 4, 1/4),
			new Note("A", -10, 1/4),
			new Note("Ab", 4, 1/4),
			new Note("A", -10, 1/4),
			new Note("E", 4, 1),
			new Note("A", -10, 1/4),
			new Note("F#", 4, 1/4),
			new Note("A", -10, 1/4),
			new Note("A", -10, 1/4),
			new Note("E", 4, 1/4),
			new Note("A", -10, 1/4),
			new Note("D", 4, 1/4),
			new Note("A", -10, 1/4),
			new Note("Db", 4, 1/4),
			new Note("A", -10, 1/2),
			new Note("Db", 4, 1/4),
			new Note("A", -10, 1/2),
			new Note("B", 3, 1/4),
			new Note("A", -10, 1/2),
			new Note("Db", 4, 1/4),
			new Note("A", -10, 1/2),
			new Note("D", 4, 1),
		],
		200, () => { console.log("Done"); });
	}

	return {
		init
	};

})();

document.addEventListener("DOMContentLoaded", () => {
	EasyPitch.init();
});
