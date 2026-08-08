This file should be things that I have learnt along the way. Big or small. Vague or in depth.

- We can get rid of the old depracted *ngIf and *ngFor for the new @if and @for etc. As we are using angular 21, not angular 17.

- the DOM (Document Object Model) is the browsers live, in-memory model of the page: a tree of objects, one per element, that the screen is rendered from. I've been thinking of the DOM/Angular wrong before, a better way to think about it is that I have my data and angular sits between my data/state and the DOM. I don't explicitly code in JS in hand to find the object in the tree, do something (like check a box) then emit an event after. Instead, I am directly interacting with the DOM elements through the angular framework, LIVE.

**rough good structure to use for this project**
- It's good to have a models folder and have interfaces to display the data types for components, then use the services to have specific methods. Then your components inside pages folder can call these services (using inject). This is a good pattern as it means we can share this data between all the components rather than it being confined to 1 component, and things like TaskService have 1 common state so that both Dashboard and ToDoList can use it and refer to the same object (this is a singleton service + signal pattern, that works well for our app)

**singals - computed & effect**
- The write side is private (only the service should write to the signal), the read side is public (the components get a readonly view of the signal). Components get theme (read-only) and must go through setTheme(...) to change it. That means the one place something can go wrong is one method in one file — when something breaks, you know where to look.
- So we know about signals now - a box holding a value. However, 2 kinds of things can subscribe to a box: 1. computed - produces a new value from other signals, its for data (returning something) 2. effect - performs a side-effect when signals change, its for actions on the outside world (so these are more things that do something rather than returning something, for example writing to localStorage)
  A rule of thumb that will serve you well: if you can express it as computed, do; reach for effect only when you genuinely need to touch the outside world. Your codebase already follows this — the only two effects are the two places the app talks to localStorage/the DOM, and everything else (counts, percentages, sorting, "up next") is computed.
- So its all done through the signals in the services, we are not updating signals in the components. For example when we have methods such as addTask in to-do-list.ts that is actually calling the addTask method in task.service.ts and THAT is where the tasksSignal is upated.

- I've learnt what a spread is:
  'return [...this.taskService.tasks()].sort('
  The '...' above is the spread syntax, meaning "unpack the contents here". So the above is spreading the array before sorting it. The reason we actually do this is because .sort is a mutator, unlike filter and map which return new arrays. Signals share references, and sort mutates — so never sort (or otherwise mutate) what you read from a signal; copy first at the level you're changing.

- [checked] and [(ngModule)] are both ways to connect data to an input, but they differ in which way data flows and whos allowed to write
  [checked] is one-way: data -> DOM
  [(ngModel)] is two-way: data <-> DOM

- "signals push notifications and pull values" (for my project that is), ok, what does that mean?
Here I talk about 1 (a way that signals can be used) and 2 (how I use signals)
  1. Push the value: the signal immediately hands the new array to everyone who depends on it — "here's the new list, do your thing." This is how event emitters and RxJS subjects work: next(value) delivers the value to each subscriber, right then. (this is not what I do)
  2. What my signals do instead (pull the value): the signal pushes only a tiny, payload-free notification — a dirty flag: "what you last read from me is stale." Nothing computes yet. The actual value moves later, when a consumer runs and reads the signal — the read is the pull.
- There is no correct way to use signals, 2 works for my project well, but in other aspects 1 is better. So the rule of thumb to file away: if losing intermediate values is acceptable — it's state; use a signal. If every occurrence matters — it's an event; use push.

- "The persistence effect overwrites, never merges" (for my project that is), ok, what does that mean?
Here I talk about 1 (a way a persistence layer can work) and 2 (how my persistence layer works)
I currently have a localStorage persistence layer. There are 2 ways a persistence layer can work:
  1. Merge (read-modify-write): read what's stored, apply the change to it, write the result back. "Add task X to whatever is there."
  2. Overwrite (snapshot): ignore what's stored entirely; serialize your current in-memory state and replace the stored blob wholesale. "Storage, become a copy of me."
- My effect() are pure overwrite. However this has problems for example if you have 2 tabs, 2 devices etc. The last writer will win and that will be the state of the data, the other stuff is lost. However, this is exactly what will change once we add the backend.

- We have learnt that our current localStorage data persistence strategy isn't the best and can lead to some data being wiped if JSON is corrupted and things like that, but we will fix this when we add a backend. Also it doesn't work well if we have 2 tabs open, or 2 devices.

- Great idea to write tests once you get to a decent point in your application (this can help pin down your current logic, make sure there aren't regressions)

- Good idea to change the style of your code from type (ie models and services folders) to by feature (journal folder has everything in it). I've done this now because it makes it easier when scaling and angular recommends it.