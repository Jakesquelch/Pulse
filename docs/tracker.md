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
Ok now looking at doing the persistence-seam refactor. Done that.

Now scaffolding the backend:
- Create backend folder
- setup venv and install fastAPI and uvicorn
- create main.py

**9th August:**
Made a change to the dashboard. Updated some of the text with more of a vision and purpose of this app that I have. Everyone can fall into traps of being a fake productive person, having a never ending todolist of what quite frankly 90% of the things don't really matter, and only 10% of the things on the todolist are actually moving the needle. So the purpose of this app is to allow the users to cut the noise out and focus on what is the signal, what are the things they should be focussing on to get the greatest return, and how can we cut out habits/todolist tasks that don't actually serve us. When you have meaning behind an app its like it becomes something real and actually builds meaning for myself and therefore is just better and something that can be improved and I am more passionate about.

Ok so yesterday we started to setup our FastAPI backend. We just have a hardcoded GET /tasks endpoint atm (this is just checking that we can send data out from our server). We are now going to create a POST /tasks endpoint so that the server can listen (receive data in, validate it, store it). Right now we don't have a DB set up, so the data lives in the servers memory, so it dissapears when the server restarts, that's fine for now, we will add persistence later.

So we are now looking at POST /tasks. I believe the frontend client will pass task data to our backend (our backend will validate that data), then pass it to our server?

wiring up our frontend to our backend API
Now we are going to wire up Angular's TaskService to GET /tasks so now we can talk to our backend from the frontend and get tasks
Have also wired up Angular's TaskService for POST /tasks so it now can send data to our backend when a user creates a task

**11th August:**
Changing the name from JakeOS to Pulse, as Ben pointed out, its not an OS so the previous name is deceiving. I think Pulse is a good name because this app should be something that is constantly going (like a pulse), it should be an app that drives your life (it steers you in the right direction), it is essential (without a pulse you die), without this app, you struggle to prioritise, brain dump, and have direction.

I'm getting low on Fable tokens so I have got it to write up a plan for the future, so I can then drive opus against that plan and complete the work.
Ok so we are mid-migration, we have setup GET /tasks and POST /tasks, we now need to do DELETE and PATCH. Let's start that now. Done. So our whole Task part is set up with my own REST backend API.

**12th August:**
Now adding persistence (if we add a task and then restart the backend, that task will now stay there)
So we added persistence by adding our DB.

We now need to work on phase 3 in fable plan which is Honest failure handling

**13th August:**
Need to deal with HTTP failures (for example the backend being down or something). Right now the user isn't told that. Also if a GET tasks fails, the error is unhandled.
Updated frontend tests and added backend tests too.

**14th August:**
Now migrating habit and journal stuff (they are still using localStorage)
- Update comments and docs that are stale/outdated

MVP IS NOW DONE!

Post MVP stuff to do:
- Look at the App from a UX POV and improve it, also make UI improvements
- Add more tests (add component tests too)
- Can we tweak localhost:8000/docs so that the endpoints are sectioned into habit, journal, todo etc
- Get playwright MCP to walk through the app