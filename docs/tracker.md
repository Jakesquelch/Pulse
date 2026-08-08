### Tracker:

**26th June:**
I kind of vibe coded this a while back. Picking it up now but am working from the bottom up. Spending some time to learn the code, learn what's happening, and get my surroundings a bit, before I continue to do any work on this. Created the new [File](./my-understanding.md). I want to have more ownership over this project, understand what is going on and almost each line of code.

Next time: Continue reading through the docs, learning how the code works, and updating my-understanding. Look through architecture.md and go file through file getting claude to explain it. Really go deep and understand.

**3rd July:**
Testing out Fable to give me some advice on improvements.
Task 1: Move the task stuff into a service. Currently the ToDoList component has a tasks array. This means we can't share this data with other components and we also lose it when we refresh.
Task 2: Add data persistence
I believe we will start with persistent local storage, then we can move onto looking at backend stuff after that.
Learnt about signals.
Then added in the journal and habit tracker sections with the same model-service architecture
Now going to make some design changes to make it look better, before moving onto backend stuff.

Next time: Take a look at the updated architecure.md and features.md file then maybe update the my-understanding doc. All while consolidating what has happened, delving into the code a bit, and trying to gain a better understanding. A lot of changes happened today. So we don't want to progress too quickly.

**7th July:**
Before we continue developing this and adding lots more lines of code I want to get a better grip of this project. Going to slow it right down. Want to understand things better before continuing. Feel like I may be getting a bit lost. And I want my understanding to be better before we get too deep, get completely lost, and want to stop working on this.

**24th July:**
Just been playing around with some AI stuff. Added my own skill for this project. Used the Playwright MCP and drove it through our web app and that picked out some errors. Still wanting to not really move this project forward too much for now, until the understanding is all there. Added the visual.md mermaid file which I think I will use to help me understand the architecture of this project.

**4th August:**
Goal is to fully understand where we are up to so that we can move forward with this now.
Checkout [this](./next-time.md) and work through it. Updating my-understanding.md along the way.

**6th August:**
Checked out an md file that had a long prompt talking me through the app and how it works etc. Made some good progress and understanding of the app on a bit of a deeper level, made some small tweaks to the code but mostly have been updating the [my-understanding](./my-understanding.md)
Really trying my hardest to not continue developing just yet until i've looked through all the code & keep asking questions to AI, got rid of fluff, have a good understanding. This is hard to do, I'm getting a bit impatient, a bit confused, and want to just move on now. But this is actually good, and I'm learning a lot, and just being curious and letting myself go down little rabbit holes and just asking questions and jotting down notes in learns and my-understanding.
I think for now I want to do a bit more learning. Get claude to have a look at my-understanding and my-learns and see what is next, after that, we can take a look at whats next.

**7th August:**
Think we have a fairly good understanding now of the wider architecture and the patterns of how this project is working (in terms of the services and signals etc). I don't understand the very specific syntax stuff in the pages folder etc but I don't think that is 100% necessary right now. 
We are going to start making some changes now, I'm going to start by writing some service tests using Vitests. 
Through writing the service test (task.service.spec.ts) we have learnt about some flaws in our current localStorage data persistence strategy (overwrites corrupt stored data with an empty list one tick later - data gets wiped), that will be improved in the future once we add the backend. Some of our tests will fail once we change to backend (this is actually good and means we have improved problems).
Next I will take a look at doing HabitServices spec.

**8th August:**
I think its true that with AI you can get stuck in kind of a never ending cycle of looking into the code very deeply, getting suggestions and learning etc. You get to a certain point where its time to move forward, I think I've got there. 
Going to continue with writing the tests (did Habit service test)
Did a HUGE refactor of the structure of my codebase. Before I had everything ordered by type, for example I had my pages folder with the css, ts and html, then my services folder, then my models folder. Now instead of doing it by type I have structured the codebase by feature. So all the stuff for journal (the html, css, ts, test file, service, model) are all in one place now.
Going to have a read over the docs that have all been updated, maybe create a new md file with what we are now going to do moving forward - also should I do a test file for journal?