const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');

const ppData = {
  small: {
    representation: '8==D',
    compliments: [
      'Looks cute!', 'Is that even a size?', "A little shy, aren't we?",
      'Every little bit counts!', 'Perfect for the pocket!', 'Great things come in small packages!',
      'Small but mighty!', 'Easy to handle!', "You're all about finesse!", "It's a thoughtful size!",
    ],
  },
  medium: {
    representation: '8===D',
    compliments: [
      'Not bad at all!', "That's decent!", 'Could use a bit more, but still good!',
      'Just the right balance!', 'A solid choice!', 'Good for everyday use!',
      'Comfortably sized!', 'Fits the bill perfectly!', 'You know how to keep it reasonable!',
      "That's a nice, sensible size!",
    ],
  },
  average: {
    representation: '8====D',
    compliments: [
      'Pretty average!', "Just what you'd expect!", 'Satisfactory, but nothing to brag about!',
      'A reliable performer!', 'A safe bet!', 'Comfortably normal!',
      'Nothing wrong with being average!', "You're keeping it real!",
      'That size is just right!', 'A well-rounded choice!',
    ],
  },
  large: {
    representation: '8=====D',
    compliments: [
      "Now that's impressive!", "You've got something to show!", 'Very nice size!',
      "It's a crowd-pleaser!", 'Great for some fun!', 'Definitely stands out!',
      "You're making waves!", 'That size is hard to ignore!',
      'You know how to draw attention!', "That's a significant upgrade!",
    ],
  },
  huge: {
    representation: '8======D',
    compliments: [
      'Wow, quite impressive!', "That's a bold statement!",
      'You know how to make an impression!', 'Not for the faint-hearted!',
      'A real showstopper!', 'You mean business!', "That's a game changer!",
      "You've got some serious confidence!", "You're raising the bar!", 'That size has presence!',
    ],
  },
  extraLarge: {
    representation: '8=======D',
    compliments: [
      "That's massive!", "You've got some confidence!", 'What a sight to behold!',
      'A true masterpiece!', "It's hard to ignore!", 'An absolute unit!',
      "You're in a league of your own!", "You've really outdone yourself!",
      "That's a bold choice!", 'Expecting a standing ovation!',
    ],
  },
  massive: {
    representation: '8========D',
    compliments: [
      'Truly a sight to see!', "You're a show-off!", "That's just extra!",
      'Ready to take on the world!', "You've outdone yourself!",
      "That's impressive, no question!", "You're going for gold!",
      'That size is simply monumental!', "You don't play small!",
      'Expect some serious attention!',
    ],
  },
  legendary: {
    representation: '8=========D',
    compliments: [
      'A legendary size!', 'Unbelievable!', "That's a myth in the making!",
      'Epic proportions!', "You've reached the pinnacle!", 'A true legend!',
      "You're the stuff of legends!", 'That size is practically mythical!',
      "You're rewriting the book on size!", 'Absolutely iconic!',
    ],
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('joke')
    .setDescription('Get a random joke, fact, or fun thing!')
    .addStringOption((o) =>
      o
        .setName('type')
        .setDescription('What kind of content do you want?')
        .addChoices(
          { name: 'Joke', value: 'joke' },
          { name: 'Dad Joke', value: 'dadjoke' },
          { name: 'Cat Fact', value: 'catfact' },
          { name: 'Dog Fact', value: 'dogfact' },
          { name: 'PP Size', value: 'pp' }
        )
    ),

  async execute(interaction) {
    const type = interaction.options.getString('type') || 'joke';

    if (type === 'pp') {
      const sizeKeys = Object.keys(ppData);
      const selectedSize = sizeKeys[Math.floor(Math.random() * sizeKeys.length)];
      const { representation, compliments } = ppData[selectedSize];
      const randomCompliment = compliments[Math.floor(Math.random() * compliments.length)];

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('pp Size Generator')
        .addFields(
          { name: 'pp Size:', value: representation, inline: true },
          { name: 'Size Category:', value: selectedSize.charAt(0).toUpperCase() + selectedSize.slice(1), inline: true },
          { name: 'Compliment:', value: randomCompliment, inline: false }
        )
        .setFooter({ text: 'Enjoy the fun!', iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    try {
      if (type === 'joke') {
        const response = await fetch('https://official-joke-api.appspot.com/random_joke');
        const joke = await response.json();
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('🎭 Joke')
          .addFields(
            { name: 'Setup', value: joke.setup, inline: false },
            { name: 'Punchline', value: joke.punchline, inline: false }
          )
          .setTimestamp();
        return interaction.reply({ embeds: [embed] });
      }

      if (type === 'dadjoke') {
        const response = await fetch('https://icanhazdadjoke.com/', {
          headers: { Accept: 'application/json' },
        });
        const jokeData = await response.json();
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("Here's a Dad Joke for You!")
          .setDescription(jokeData.joke)
          .setFooter({ text: 'Want another one? Use /joke again!' });
        return interaction.reply({ embeds: [embed] });
      }

      if (type === 'catfact') {
        const response = await fetch('https://catfact.ninja/fact');
        const factData = await response.json();
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('Did You Know?')
          .setDescription(factData.fact)
          .setFooter({ text: 'Want another fact? Use /joke again!' });
        return interaction.reply({ embeds: [embed] });
      }

      if (type === 'dogfact') {
        const response = await fetch('https://dog-api.kinduff.com/api/facts');
        const factData = await response.json();
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('Did You Know?')
          .setDescription(factData.facts[0])
          .setFooter({ text: 'Want another fact? Use /joke again!' });
        return interaction.reply({ embeds: [embed] });
      }
    } catch (error) {
      console.error(`Error fetching ${type}:`, error);
      return interaction.reply({
        content: "Sorry, I couldn't fetch that right now. Please try again later.",
        ephemeral: true,
      });
    }
  },
};
