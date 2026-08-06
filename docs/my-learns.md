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
