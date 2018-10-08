/*
	A library for easily playing notes in browser
*/
const EasyPitch = (() => {

	window.AudioContext = window.AudioContext || window.webkitAudioContext;
	/* The audio context used by this library */
	let context = new AudioContext();

	/*
		The frequencies of notes in octave 8 by name
	*/
	const noteFreqs = {
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

	/*
		A rest. Time where no note is played.
	*/
	class Rest {
		
		/*
			Creates a rest of the given length
			@param length - number - 1 for whole note, 1/2 for half-note, 1/4 for quarter-note, etc.
		*/
		constructor(length) {
			this.length = length;
		}

	}

	/*
		A note with a name, octave, and length (whole note, half-note, quarter-note, etc.)
	*/	
	class Note {

		/*
			Fields:
				name - string - the name of this note (A, B, C#, Db, etc.)
				octave - integer - the octave of this note (using scientific pitch notation)
				length - number - the length of this note (1 for whole note, 1/2 for half-note, etc.)
		*/

		/*
			Creates a note object from the given data
			@param name - string - the name of this note (A, B, C#, Db, etc.)
			@param octave - integer - the octave of this note (using scientific pitch notation)
			@param length - number - the length of this note (1 for whole note, 1/2 for half-note, etc.)
		*/
		constructor(name, octave, length) {
			this.name = name;
			this.octave = octave;
			this.length = length;
		}

		/*
			Returns the frequency of this note
			@param - number - the frequency of this note
		*/
		getFreq() {
			let octaveScale = Math.pow(2, this.octave - 8);
			return octaveScale*noteFreqs[this.name];
		}
	}

	/*
		An instrument. Determines how a note will sound based on
			the given waveform function
	*/
	class RawInstrument {

		/*
			Fields:
				waveformFunc - (number, number, number) => number - the function that defines the waveform
					with the signature (t, freq) => number where t is the current time in seconds
					and freq is the frequency of the note to be played and the output is the position of the wave
					and tmax is the maximum value of t (the note length in seconds)
		*/

		/*
			Creates an instrument from the given waveform function
			@param waveformFunc - (number, number) => number - the function that defines the waveform
				with the signature (t, freq, tmax) => number where t is the current time in seconds
				and freq is the frequency of the note to be played and the output is the position of the wave
				and tmax is the maximum value of t (the note length in seconds)
		*/
		constructor(waveformFunc) {
			this.waveformFunc = waveformFunc;
		}

		/*
			Plays a note of the specified frequency for the specified amount of time
			@param freq - number - the frequency to play
			@param time - number - the time in seconds to play the note for
		*/
		_playFreq(freq, time) {
			let source = context.createBufferSource(); // creates a sound source
			let buffer = context.createBuffer(2, context.sampleRate*time, context.sampleRate);
			for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
				var channelBuffer = buffer.getChannelData(channel);
				for (let i = 0; i < channelBuffer.length; i++) {
					channelBuffer[i] = this.waveformFunc(i/context.sampleRate, freq, time);
				}
			}
			source.buffer = buffer;                    // tell the source which sound to play
			source.connect(context.destination);       // connect the source to the context's destination (the speakers)
			source.start(0);
		}

		/*
			Plays the given note at the specified bpm and calls the callback when finished
			@param note - Note|Rest - the note to play
			@param bpm - number - the beats per minute
			@param callback - () => void - called when the note is done playing
		*/
		playNote(note, bpm, callback) {
			let secondsPerWholeNote = 60/bpm;
			let seconds;
			if (note instanceof Note) {
				seconds = secondsPerWholeNote * note.length;
				this._playFreq(note.getFreq(), seconds);
			}
			else if (note instanceof Rest) {
				seconds = secondsPerWholeNote * note.length;
			}
			setTimeout(callback, 1000*seconds);
		}

		/*
			Plays multiple notes, waiting until the previous note has finished before playing the next one
			@param notes - Note[] - the notes to play
			@param bpm - number - the beats per minute
			@param callback - () => void - called when all notes are done playing
		*/
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

	/*
		Returns the amplitude scale for linear attack and decay.
		Increase in volume up until attackPoint and then stays at max volume until
			decay point where it starts decreasing until x=1.0 where the volume
			will be zero
		@param x - number - the progress of the note being played (in the interval [0, 1])
		@param attackPoint - number - the value of x at which to reach max volume
		@param decayPoint - number - the value of x at which to start decaying
		@return number - the volume at the point x based on the attack and decay function 
	*/
	function attackAndDecay(x, attackPoint, decayPoint) {
		if (x < attackPoint) {
			return (1/attackPoint) * x;
		}
		else if (x < decayPoint) {
			return 1.0;
		}
		else {
			let slope = -1.0/(1.0 - decayPoint);
			return slope*(x - decayPoint) + 1.0;
		}
	}

	/*
		An instrument that is based on a base waveform and overtone series.
	*/
	class Instrument extends RawInstrument {

		/*
			Commonly-used wave functions
			Signature: (number) => number
			The wave function takes a time t in seconds, and produces the output waveform
				with a value in the interval [-1.0, 1.0]
		*/
		static get WAVES() {
			return {
				SQUARE: (t) => (t%1) < 0.5 ? 1.0 : -1.0,
				TRIANGLE: (t) => 2.0*(t % 1.0) - 1.0,
				SINE: (t) => Math.sin(2*Math.PI*t)
			};
		}

		/*
			Creates an instrument with the given overtones
			@param overtones - number[] - the weightings of each overtone starting at
				the fundamental frequency and increasing to 2*fundamental, 3*fundamental,
				4*fundamental, etc.
			@param waveFunc - (number) => number - the function for the wave (amplitude in [-1.0, 1.0] and wave must have one cycle per second)
				default is a sine wave
		*/
		constructor(overtones, waveFunc) {
			waveFunc = waveFunc || SimpleInstrument.WAVES.SINE;
			let overtoneSum = overtones.reduce((a, b) => a+b);

			super((t, freq, tmax) => {
				let sample = 0;
				for (let i = 0; i < overtones.length; i++) {
					let overtoneFreq = freq*(i+1);
					let wave = waveFunc(overtoneFreq*t);
					let amplitude = overtones[i] * attackAndDecay(t/tmax, 0.1, 0.5);
					sample += amplitude*wave;
				}
				return sample / overtoneSum;
			});
		}
	}

	return {
		Instrument,
		Note,
		Rest
	};

})();
