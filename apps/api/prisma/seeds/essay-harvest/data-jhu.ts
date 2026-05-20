// Johns Hopkins University "Essays That Worked" — full essay text harvested from
// https://apply.jhu.edu/hopkins-insider/application-section/essays-that-worked/
// All these essays are from admitted students (publicly published as "essays that worked").
// All school = Johns Hopkins University. Essay type COMMON_APP unless clearly a "Why JHU"
// transfer essay (then WHY_SCHOOL).
export interface EssayRecord {
  schoolName: string;
  year: number;
  result: 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED';
  essayType:
    | 'COMMON_APP'
    | 'UC'
    | 'MAIN'
    | 'SUPPLEMENTAL'
    | 'WHY_SCHOOL'
    | 'SHORT_ANSWER'
    | 'ACTIVITY'
    | 'OPTIONAL'
    | 'OTHER';
  essayPrompt?: string;
  essayContent: string;
  sourceUrl: string;
  authorFirstName?: string;
  tags?: string[];
}

export const JHU_ESSAYS: EssayRecord[] = [
  {
    schoolName: 'Johns Hopkins University',
    year: 2024,
    result: 'ADMITTED',
    essayType: 'COMMON_APP',
    sourceUrl:
      'https://apply.jhu.edu/hopkins-insider/where-math-collides-with-art/',
    authorFirstName: 'Anthony',
    tags: ['jhu', 'essays-that-worked', 'math', 'stem'],
    essayContent: `Pop quiz: A bird shoots through the crisp morning air of New York City, dodging skyscrapers at a speed of thirty kilometers per hour. The sun breaks through the horizon, blinding the bird in both eyes. The bird manages to catch its reflection in the shining glass of the Empire State Building—but by that time, it's too late. How do we use velocity, angles, distance, and force to find the point at which the glass shatters?

For me, math is more than just numbers. It's a mode of visualizing movement in action, the synthesis of my imagination and the physical world. When I'm problem-solving, I'm not just generating a string of numbers on paper. I'm picturing the spiral of a rollercoaster, the friction of a waterslide, and the curvature of an asteroid's impending collision with Earth.

In high school, when precalculus was taught as a series of step-by-step instructions, it felt like the vivid and colorful world I had come to love was being broadcast in black and white. I saw this reflected in the growing disinterest of my classmates, who saw math as a monotonous chore rather than a universal language with boundless explanatory and creative power. I had to step in. I had to show people what I saw.

This inspired me to begin writing creative math questions for my peers. My parametric equations are not simple problems with one-step calculations– they are cinematic universes that jolt audiences with excitement. They invite others to embrace mathematics as a practice of external—and even internal—discovery that was missing in my school.

When I present my famous "bird crashing into the window" problem students enthusiastically gather around the whiteboard to uncover its mysteries. I watch their impassioned discussions unfold with a sense of satisfaction as each drawing and scribble brings them closer to the truth. Witnessing their pride as they finally arrive at the answer reminds me of why I teach.

I've since honed question-design into an art, creating math tests and exercises for Teachers Pay Teachers so that teachers around the world can give my imaginative questions to their students. I hope that students not only learn the concepts I'm teaching– but also critical thinking and reasoning that provides new ways to solve challenges in their lives.

I have also used the medium of math beyond problem sets and assessments. As captain of the Math Olympiad, I use it to transform confused faces into laughter and excitement, to test my teammates' courage and strengthen team bonds. When I tutor Mu Alpha Theta or teach in Wall Street Lions, it is a language of empathy and connection to connect with students with interests outside of STEM. And in CivicSpark—the non-profit I co-founded to help students gain agency through civic engagement—I deploy the logic and reasoning of math without the numbers. Through a curriculum of imaginative puzzles, I empowered students in schools across Southern California to reach out to their representatives to ignite real change.

In this way, I have used math as a brush to paint a canvas that extends beyond the visual to what matters most—infusing life with greater meaning and heart. It is this creativity that compels me to pursue Applied Mathematics. There is no greater or more fulfilling challenge than the application of mathematics to real-life problems. However I hope to take this application a step further: If every calculation is a story, what does it mean for us to become storytellers? And how can this intellectual artistry transform the world?

As for the bird that caught its reflection in the office window–perhaps it isn't about the force of the collision, but what happens after. The way the shards of glass multiply a single reflection into thousands of new perspectives. The way a barrier opens to reveal spaces that were previously hidden. And the infinite possibilities of what happens next.`,
  },
  {
    schoolName: 'Johns Hopkins University',
    year: 2024,
    result: 'ADMITTED',
    essayType: 'COMMON_APP',
    sourceUrl: 'https://apply.jhu.edu/hopkins-insider/a-splash-of-color/',
    authorFirstName: 'Emily',
    tags: ['jhu', 'essays-that-worked'],
    essayContent: `I stare into my bathroom mirror as I remove the mask. For the first time, I will attend high school showing my full face. I need to be beautiful, just like the girls on my TikTok feed. I examine each video, searching for the common thread. A hot pink blush gleams on each girl's cheek. Despite the stark contrast between my pale Irish skin spattered with freckles and that of the sun-kissed influencers, I race to Target to search for the infamous Revlon Insta-Blush which comes in stick form, making it foolproof. Or, so I thought.

On the first day of school, I optimistically swipe the stick across my face, waiting for instant beautification. But, my embarrassingly pink cheeks redden as they attract a different type of attention. I quickly banish the blush stick to the back of my makeup drawer. In need of a confidence boost, I vow to add color into my life instead of my face.

An opportunity presents itself near the end of freshman year as I sit in World History class with my friends Hannah and Julia. Suddenly, they thrust their iPads in my face. They smirk, informing me that "Glenbard West is looking for its next weather reporter." I join them in laughter but steal a second look at the email. My eyes betray me. Both catch my second glance.

"Oh my gosh, Emily, I dare you!" Hannah screeches. I shrug, click the sign-up link and hastily complete the form. Later, I am invited to submit an audition video. I scoff and close the email, certain I'd quickly become a social pariah. Yet, this could be my chance to add a splash of color, to take a risk and attempt something new. I grab my umbrella as a prop, hit record and recite the script. A week later, an email entitled, CONGRATULATIONS WEATHERWOMAN!, arrives. What have I gotten myself into?!

Suddenly, it's time to compose my first report . . . to enter the eye of the storm. Conscious that every word will be broadcast to all of my peers, I keep it straightforward, simply presenting the forecast. Boring. I know something is missing. So, I create a catchy sign-off, "Keep it Cool in the Castle West" which references our school's castle-like logo.

On recording day, I stare into my bathroom mirror once again. My eyes drift toward a single tube of coral blush I had been given two years prior. Its soft, sunset orange hue in stark contrast to that TikTok trending hot pink. I slowly dab the Glossier Cloud Paint blush onto my cheeks. It gives my pale skin a natural glow, one that emulates my happiness. My confidence shines as I record my first segment.

Later, when the broadcast projects into my classroom, my nerves take over. I bury myself into my iPad, trying to disappear. After class, I venture into the hallway, eyes glued to the floor.

"Great job with the weather!" someone yells. Another waves. I shoot upright, scanning from one smiling face to another. As I record more and more broadcasts, even people I hadn't known before begin to say "hi" to me across campus. I'd always been one with a small, tight circle of good friends, but unexpectedly, my social network broadens as my campus "celebrity" grows. As I forge connections with new peers, my confidence builds. I expand my role within the broadcast and my school. I no longer recite the bare minimum but rather, report on sporting events and dare to write my own jokes. Contributing to our school spirit in this small way makes me proud. By trying new things and breaking the cage of conformity, I've also learned to love myself and my differences from the girls on social media. I wear my coral blush with pride for the freshman girl in Target. She finally learned how to be herself.`,
  },
  {
    schoolName: 'Johns Hopkins University',
    year: 2024,
    result: 'ADMITTED',
    essayType: 'COMMON_APP',
    sourceUrl: 'https://apply.jhu.edu/hopkins-insider/conquering/',
    authorFirstName: 'Faith',
    tags: ['jhu', 'essays-that-worked'],
    essayContent: `I remember being surprised at how weak my arm felt, as if I was holding a dumbbell instead of a microphone. Standing in front of all of my high school classmates at our weekly Monday Meeting, I could feel my heartbeat in my ears as I studied the small silver holes in the head of the microphone and momentarily wished I was small enough to fit into one of them and disappear. I looked down at the short Women's History month fact I had prepared and began to read. It wasn't until I felt someone come up next to me and gently push the microphone closer to my face that I realized that no one could hear me. I finished a few seconds later and fought tears as I returned to my seat amid a smattering of polite applause.

I mostly felt embarrassed; I had failed at such a simple task and allowed my nerves to hijack my voice. For the rest of the meeting, I watched our Student Body President, a brilliant, charismatic senior make announcements and crack jokes with an apparent ease that I couldn't fathom. I had so much respect and admiration for his public speaking skills– I wished I had the courage to be up there, self-assured and composed. As my embarrassment ebbed I felt another feeling boiling up in me; a sudden resolve. I wanted to get up there one day and try again.

Naturally a reserved person, adjusting to a new school freshman year had been difficult. I found a weird solace in hiding behind the masks we were still wearing at the time– covering most of my face made it easier to remain in my own little bubble, quietly observing others. Given my shyness, I was a bit surprised when a teacher encouraged me to run for Student Council. I surprised myself even more when I decided to run. The idea of being one of the student leaders who I so admired, up there leading the meetings, scared me, and yet it simultaneously drew me in like a magnet for reasons that I couldn't have fully articulated at the time. It was precisely the fear that made me want to try– I wanted to prove to myself that I could conquer it.

This inescapable pull towards things that scare me has extended into every aspect of my life, from public speaking to basketball to academics. Aside from the responsibility I feel to myself, I often think about people less fortunate than I am; my cousins in Florida, family members in Jamaica, and girls just like me around the world who will never have access to an education. Many of them will never have the chance to take an AP science class, give a TEDx talk, or run for Student Council. I feel that I owe it to them, too, to take advantage of every opportunity, even the daunting ones. Getting out of my comfort zone is not just a personal obligation; it's a privilege and a blessing.

Now, in front of my classmates as Student Body President, holding the microphone doesn't trigger the waves of panic it once did. I no longer study the holes in the microphone; thanks to experience, I have gradually felt empowerment take the place of horror when I have the microphone in my hand. Recently, an underclassman told me that even though she loves being in Student Council, she would never run for President, because she could never get up there and speak like I do. She said it flippantly, like it was just a fact, but I saw so much of myself in her and immediately pushed back. She can. Because I did. Ultimately, that's the best part of holding the microphone- being an example and encouraging those who I'll eventually pass it on to, like so many others did for me.`,
  },
  {
    schoolName: 'Johns Hopkins University',
    year: 2024,
    result: 'ADMITTED',
    essayType: 'COMMON_APP',
    sourceUrl:
      'https://apply.jhu.edu/hopkins-insider/balancing-life-a-life-of-balance/',
    authorFirstName: 'Jade',
    tags: ['jhu', 'essays-that-worked'],
    essayContent: `The concept of balance guides me through life. At heart I am a figure skater. Since early childhood I've learned how to balance on and off the ice rink; to glide though skating routines and busy schedules. While I'm skating, time moves differently. I put my soul into each moment. I morph into the embodiment of my emotion and determination. I practice until it is perfect. I pass into a different state of mind, where I'm able to focus fully. I devote hours, and yet it feels as if no time is passing. I bring this pattern of dedication to all of the commitments in my life, and use my sense of balance to handle it all.

I keep moving, on and off the ice, from one thing to the next, because balanced doesn't mean stagnant. In figure skating, and in life, movement helps keep me balanced. I've been raised entirely alone by my single mom, no custody time with my father. We live in an 1860's log cabin with a lawn to mow, and feral rescue cats. We spend every July in a cottage in Canada helping my grandmother, and I help clean the AirBnB in our basement before every stay. It is important I keep gliding through everything in a timely manner, since it's just the two of us, with lots of responsibilities, and no one else to pick up slack. From my mom I've learned early how to be resourceful, self-reliant, and to manage time effectively, including downtime. Sometimes that's a challenge. Sometimes I start to feel off balance. Like when I'm in Boston for the Eastern regional synchronized skating competition, having to learn lines for my lead in the school play, and studying for AP classes. But my mom is always there if I need help strategizing. So when life accelerates, I take a deep breath. Even if the speed feels ominous, just like in skating, immersing myself feels liberating. It is all the more rewarding when my work is completed and I get to reflect on everything I've accomplished.

When I'm interested in something new to balance I look to my community. I am always the first to offer assistance at my school's numerous volunteer opportunities. I regularly enlist in trips to a Rescue Mission, and have over 3 times the community service hours required to graduate. I also find activities through connections outside school. Like the Endangered Species Theater Project teen led production I was in last spring. On my own initiative, one of my passions is filmmaking. I plan to major in film studies. I enjoy the medium because it is the closest an audience can get to a story. I thrive in long editing sessions, writing marathons and as my own actor in solo projects. Every film project I create is another flex of my balancing skills.

Yes I'm a regionally qualifying synchronized figure skater, but I'm also a fourth degree black belt in Taekwondo; I'm three term president of my school's student government association; I've been lead in the school play two years in a row; I'm an AP Scholar, a guitarist, and a pianist. I'm a leader, a fighter, a vegetarian, an actor, an athlete, a friend, a musician, a cinematographer, and a straight A student. For my endeavors to go smoothly I've honed my sense of balance, and dedicated myself: to the arts, knowledge, and community.

I've sculpted myself into a balance beam holding multiple high level skills at once. I love learning, improving, and making an impact in every section of my life. I feel proud of the work I am completing in such diverse ventures. I am always happy as a fulcrum, the balance point of a lever system, I am the "Renaissance man." I love to succeed in each pursuit, to accomplish many things in a variety of areas, and I am always searching for more.`,
  },
  {
    schoolName: 'Johns Hopkins University',
    year: 2024,
    result: 'ADMITTED',
    essayType: 'COMMON_APP',
    sourceUrl:
      'https://apply.jhu.edu/hopkins-insider/be-the-salt-of-the-earth/',
    authorFirstName: 'Maria',
    tags: ['jhu', 'essays-that-worked'],
    essayContent: `"No le pongas demasiada sal!" My mom, anticipating a bitter taste from the soup, alarmed me. Yet curious like a five-year-old, I felt it was my mission to discover the secrets behind the little white container in front of me. Standing still, making noise at a shake, laid the salt. Deciding to empty half the recipient, my mom and I laughed the second I tasted our alphabet soup.

Composed of primarily sodium chloride, salt is a staple for food and culture. At the same time, the element is an equal symbol for health, preservation, and connection. Seen time again in history, salt was a compensation for Roman Empire's soldiers, a source of currency for ancient China, and an exchange in the Gulf Coast from the Olmec people. Globally, a little of it goes the long way.

Ironically, for the entirety of my early adolescence, I underestimated the value of salt in the human body. How could such a small grain be worth immense value? It appeared like an exaggeration. Despite my assumption, fainting in the presence of heat conversely transformed this mindset. Then, I was not surprised to know I battled with low blood pressure. To prevent injuries, I was advised to intake balanced meals. Most importantly, moving from one state to another forced me to keep track of possible imbalance in my body at the end of my junior year.

With an opposing view of the country, I was intrigued at smoky undertones of sea salt in brown rice, at a piece of boiled egg with table salt, or at a pinch of pink salt in a fresh avocado. Unable to eat foods with high sodium, I grew appreciation at the appearance of soul meals in new places. Mere glimpses at dishes fueled my taste examinations. While exchanging interactions with a diverse school population throughout lunch time, I met teenagers and teachers with a history of resilience, migration, and adaptation. Fascinated by the mural of cultures, each little grain of salt in my vision embodied human connection, presenting roots and traditions with pride. My new communities were an open door to discover distinct salt flavor profiles.

Throughout my personal progress of adaptation with moving, I discovered my love for the range of policies, economies, and customs bounded in the world. Enamored by the study of international relations, my pursuit for educating on the states of societies, financial positions, dearth of rights, and extent of access to resources arrived naturally. In a similar way that I enhance my knowledge of salt's contributions, I am committed for my expatiating my passion towards diplomacy. Exhibiting my devotion for the protection of interests and sustaining peace, the epiphany of helping not just my home countries in the US and Mexico but vulnerable groups at developing countries became my mission.

At the gaze of a welcoming sun, I practice addressing and collaborating changes particularly towards the rights of children and teenagers in my community. Implementing the first UNICEF Club at my school and district, I advocate for young children that are underrepresented, mistreated, yet are equally deserving of education and a bright tomorrow. By promoting the organization's mission, I aspire to transform beyond fixed generational chains of knowledge. Similarly, my engagement with my state's Civic Education Coalition, enlarges my infatuation of governance, civic education, and establishing a democratic future. Through my continuous experience with domestic relationships, I prepare for connections and transformations at a larger global scale.

As a person with a close connection to salt, its presence revolutionized my life purpose. Now, every grain of salt is an insight of diversity in our world and human interactions. Appreciating the intricate connection between individuals and nations, salt awakened my passion for revealing paths with solutions. In fact, I consider salt's impact on Earth as an embodiment of motivation for building systematic change. Salt is truly a symbol of our globe's shared essence.`,
  },
  {
    schoolName: 'Johns Hopkins University',
    year: 2024,
    result: 'ADMITTED',
    essayType: 'COMMON_APP',
    sourceUrl: 'https://apply.jhu.edu/hopkins-insider/building-a-universe/',
    authorFirstName: 'Shotaro',
    tags: ['jhu', 'essays-that-worked'],
    essayContent: `Just outlining the coastlines took a month. On the solid, 22-inch by 30-inch sheet of white paper I was working on, I couldn't just press the "undo" button if my highlighter happened to slip. I had spent two months creating a rough draft, and an additional month transferring that onto the final copy with a pencil. I then outlined that with a pen, which I was now going over with a highlighter. Messing up at this point meant losing four months of hard work. The stakes were high, but I was enjoying the process. I was already thinking about other details I could expand upon next. A steampunk society experiencing rapid technological advancements, I'd decided, would be the setting of this fantasy world. I imagined the technologies I could introduce in this setting. I thought about the economic and cultural indications these technologies would have on civilizations in this world. Meanwhile I continued to carefully move my highlighter.

"Worldbuilding" is a process of creating a fictional universe of your own; developing anything from the geography and climate of a continent to the annual holidays of a specific culture. The easiest way to visualize the process is to think about works by some fantasy authors, like J.R.R. Tolkien, or game developers. Though I am neither, this hobby is an important part of who I am; it reflects my interests, my curiosity, and my growth.

One reason I love worldbuilding is because of the sheer amount of questions I can ask. Research is critical to the process. The questions I've recently asked involved history (I looked at how historical nomadic empires rose to power), geology (I studied plate tectonics for a more realistic map), primatology (I researched about Great ape language to explore possibilities of interspecies communication), and computer science (I wanted to know whether computers could be invented by civilizations without electricity). The questions that worldbuilding forces me to ask open my eyes to new subjects I didn't even know existed, and this in turn enables me to work with more sophisticated worldbuilding ideas.

Worldbuilding also allows me to show my own personality within my fantasy world. The amount of detail into the world's history is reflective of my love for the subject. My passion for abstract strategy board games (like chess and checkers) has motivated me to develop a similar board game for my world. The extensive government systems of my republics and empires reflect my strong understanding of the legal system, gained through my participation in the school Mock Trial.

Two months later, standing over my finished map, I immediately noticed some flaws. I'd drawn the continents a bit too small, leaving an awkward blob of blank space on the top left of the map. On the bottom, the map legend's design was noticeably underwhelming. Overall, things could definitely be better.

And yet, gazing over my creation what I most prominently felt was pride. This moment was perhaps my favorite part about worldbuilding—taking a step back and seeing what I managed to create from scratch. In 6 months, my map came to contain three continents, 100+ islands, 50+ countries, and 60+ major cities, along with road networks, major rivers, and mountain ranges. I'd also developed various sophisticated histories, cultures, and technologies accompanying the individual societies. Worldbuilding shows you what's in your mind: stuff that amazes even yourself.

Even when the map is finished, the worldbuilding journey continues on. I'm still researching. I'm still reflecting my other passions onto my creations. My next map may identify earthquake hotspots, and it definitely will have a better organized legend. My next civilization may be built by apes, and it will surely have developed mechanical computers. Fusing knowledge, experience and imagination, the possibilities of worldbuilding are truly endless. As long as I continue to grow and learn, my world continues growing with me. I find that very exciting.`,
  },
  {
    schoolName: 'Johns Hopkins University',
    year: 2024,
    result: 'ADMITTED',
    essayType: 'COMMON_APP',
    sourceUrl: 'https://apply.jhu.edu/hopkins-insider/a-growing-world/',
    authorFirstName: 'Calla',
    tags: ['jhu', 'essays-that-worked'],
    essayContent: `Ever since I was little I've been captivated by the world around me: the squirrels in my backyard, constellations that adorned the night sky, and trees whose roots form communities spanning hundreds of miles. Every week at the library I'd check out as many animal fact books as I could carry; books became my way of exploring the world until I could experience it myself.

Once I learned about the life of Jane Goodall, I dreamed of following in her footsteps: going away for years to live in the wild and study animals. The grassy Savannah, coral reefs deep underwater, and the jungles of the Amazon called for me to discover their secrets. I spent hours crouched in the grass or behind trees with an iPad, waiting to get the perfect shot of a grasshopper or cardinal for my own books that I would write about my travels to the great unknown land of my backyard.

Since then, I've changed in many ways: I've moved to New York, made new friends, and dyed my hair, but I never lost my imaginative spirit and love for learning. Going to a small school there were few options for Science electives, so I sought other ways to explore new areas. I discovered our school had a Science Olympiad team and knew I'd feel right at home; It strengthened the sense of wonder studying science brought me when I was younger. I could be an Astronomer exploring the creation of the universe, a Forensic Scientist examining evidence to solve a crime, or a Geologist studying the rocks and minerals that form our home planet; Every day presented me with new challenges and adventures.

Through all the time I spent with my teammates studying and building together, we became an incredibly close-knit team. It was the first time I made friends who shared the same nerdy interests I did. Some of my favorite memories in high school were running tests to perfect the design of our car, studying astronomy facts by pretending we were Jeopardy contestants, and the excitement we all felt seeing our teammates succeed. I'm fortunate to have worked with so many incredible people: I got to appreciate the unique perspectives and strengths of each person, and I'm proud to say they've become some of my best friends.

In astronomy, my partner Isabella was amazing at memorizing facts and understanding the intricate details of a topic whereas I was good at understanding and applying general concepts. Dividing the work allowed us to support each other's weaknesses and let our strengths shine. By communicating to understand how we could support each other, we became partners working together towards a common goal instead of just two people who both happen to be participating in the same event, allowing us to accomplish more than we ever could have on our own.

I used to think the key to success was personal dedication because I was used to working alone to accomplish my goals. I believed the team would succeed if each person became an expert in their events, but it was communicating with each other and learning to work well as a team instead of as individuals that allowed us to succeed No great feat or discovery was the work of an individual. From flying to the moon to sequencing the human genome, it took thousands of people working together to make it possible. I never would've made hundreds of amazing memories or gained a whole new perspective on the world we live in without my teammates.

At eight years old I thought I had the world at my fingertips, but as I've grown, my horizons grew with me. Although I'm no longer traveling the world with nothing but my trusty books and imagination, I'm still always seeking out my next adventure, and now I know I'll have my teammates by my side to support me.`,
  },
  {
    schoolName: 'Johns Hopkins University',
    year: 2024,
    result: 'ADMITTED',
    essayType: 'COMMON_APP',
    sourceUrl: 'https://apply.jhu.edu/hopkins-insider/to-stand-out-or-fit-in/',
    authorFirstName: 'Caroline',
    tags: ['jhu', 'essays-that-worked'],
    essayContent: `Unicorns, rainbows, pink, and glitter.

Those elements were a commonality in my wardrobe, as I packed for a two week sleepaway camp the summer after sixth grade. The possibility of redefining myself in a new environment filled me with excitement as I dreamed of being the unique, yet "popular" girl instead of just the "nerd." However, upon arrival, that dream was shattered as my fellow campers regarded me with an air of condescension that I didn't understand. Perplexed, I asked one such camper what was wrong with me, and she said, "The way you dress. And that you ask too many questions." That summer camp marked the birth of an internal battle between my lifelong desire to stand out and my newfound desire to be accepted in society.

At first, my desire to fit in dominated this conflict. I rejected anything resembling my past wardrobe and surrendered to neutral colors and ripped jeans. However, the confines of conforming soon proved too agonizing, so my naive self devised a plan—I would be my "weird" self and accept that I would never fit in.

Guided by this framework, I began to wear unique clothing again; highlights of my wardrobe include various flowy vintage skirts, countless thrifted grandpa sweaters, and my favorite piece, a purple tank top with a star that I crocheted myself. On top of that, I cut and dyed my lengthy hair, once an anchor of my femininity and normalcy. As the war in my head waged on, standing out began to prevail, nourished by the unexpected empowerment it supplied me.

Despite embracing authenticity, however, the unease brought on by my dilemma still remained. Reflecting on this, I came to realize that self expression was like a colorful Band-Aid for my insecurities. While it boasted originality and spunkiness, ultimately what I lacked was self love. I couldn't truly embrace being myself if I didn't love myself and believed I deserved the love of others. Fighting my insecurities began with realizing that standing out and fitting in are not mutually exclusive. We all need and deserve a community to fit in with—not to conform with—but to find a place in, just like each unique piece of clothing has its perfect place in my closet.

For me, these communities came from the people and passions I engaged with. I introduced middle schoolers to the mindblowing world of coding through my passion project, Code to Create. After experiencing the exhilaration of digging into real world issues in debate club and Youth in Government, I championed my voice in our student newspaper, the Noctiluca. I put my face in front of the entire school by co-founding a video broadcast series, Spark Shorts, where I hosted segments including Teach-It Tuesday (a segment where anyone can teach anything), Spit It Out (a game show encouraging authenticity), and Oblivious Oliver (a story based segment). At state honors orchestra, I ran a meme page amassing likes and laughs while we triumphed through music together. On the science side of things, a joke on a late night call with my friends materialized into reality when we founded Quantum Astronomical Science Club, a science club with a fancy name.

Although these ventures may seem spontaneous and scattered, they collectively taught me the pure joy that collaborative learning and creativity sparks. Awed expressions as my peers and I learned about Quantum Physics together, celebratory chatter after a successful printing of a newspaper issue, triumphant fist pumps when a student's code ran correctly—those electrifying moments are what I want to live and impart upon others for the rest of my life. In the end, my internal battle between standing out and fitting in was resolved not through one side's victory, but through compromise. In my quest to stand out, I had unknowingly found just what I needed—a way to stand out and fit in.`,
  },
  {
    schoolName: 'Johns Hopkins University',
    year: 2024,
    result: 'ADMITTED',
    essayType: 'COMMON_APP',
    sourceUrl: 'https://apply.jhu.edu/hopkins-insider/being-the-handyman/',
    authorFirstName: 'Sarah',
    tags: ['jhu', 'essays-that-worked'],
    essayContent: `I've been the "handyman" of the house for as long as I can remember. I started out, armed with a roll of duct tape looped around my chubby child arms as I marched about the house, waiting for my mother to call on me. In those days, I didn't know much about the technical details but knew the phrase "duct tape fixes everything." My dad would say it as I helped my mother fix tears in folders, boxes, and even a picture frame.

I picked up sewing around third grade, when my younger sister had started to get a bit too rough with her stuffed toys. I had gotten the gist, practicing on scrap fabric, before opening shop to the slew of well-loved but torn stuffed toys me and my sister shared. My stitchwork became so good, my mother would ask that I mend and alter some of her clothes. I remember the feeling of the pin pricking my finger every time I let the needle slip, but I also know the feeling of accomplishment as the mended toys were returned to my sister, and the altered clothes fit my mother like a glove.

Carpentry became my next venture, thanks to our two large dogs, Jake and Elwood. They were lovable oafs that would try to peek through the fence at passersby. However, since they were the size of grown men, they wore down the boards and eventually broke through the fence. My father and I spent the weekend removing worn boards, measuring, obtaining new wood, and skillfully cutting and nailing replacements. The project taught me to handle larger materials. I even challenged myself to build an outdoor table and seat using the remaining boards, taking care to stain the wood and sand sharp edges. I felt a jolt of victory when my dad had sat down and the wood had not collapsed beneath him.

Entering high school, my desire to continue building led me to the school's robotics team, introducing me to 3D modeling and printers. Proficiency in CAD and the school's printers fueled my ambition to expand my skills beyond school projects. After extensive research and persuasion, my dad invested in a 3D printer, enabling me to create replacements for furniture, hooks, and even crafting personal items like a sock drawer organizer and a cat toy. Requests from friends, like modeling and printing a vacuum switch replacement, added a new dimension to my handiness.

My handyman journey extended to auto mechanics in sophomore year when I took the reins of the family's aging 1993 Ford F250. Despite its challenges—poor mileage and years of wear and tear—I refused to let it fail. Not long into driving the truck, the speedometer stopped working, and there was a clunking sound when it drove. After heavy inspection, we found that the speed sensor had come apart and lodged itself in the rear differential. As my father was getting old and not as spry as he used to be, he relied on me to open the differential and grab the piece, before flushing out metal shards and installing a new sensor. A year after the sensor failure, the suspension started to fail, requiring new shocks. The truck was a cycle of things breaking and being fixed, but it also taught me the more common skills of routine oil changes and how to jump start the battery.

In the end, my journey as the household "handyman" has been a continuous evolution. From early days with duct tape to mastering sewing, carpentry, 3D printing, and auto mechanics, each skill acquired has not only enhanced my technical prowess but also cultivated a sense of responsibility and determination. The diverse challenges I've tackled have molded my growth, instilling a resilient spirit that thrives on the joy of learning through hands-on experience.`,
  },
];
