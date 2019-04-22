const express = require('express');
const bodyParser = require('body-parser');
const graphqlHttp = require('express-graphql');
const { buildSchema } = require('graphql');
const mongoose = require('mongoose');

const app = express();

const Event = require('./models/events');

const User = require('./models/users');

const bcrypt = require('bcryptjs');
let createdEvent;

app.use(bodyParser.json());

app.use('/graphql',
    graphqlHttp({
        schema: buildSchema(`
            type Event {
                _id: ID,
                name: String!,
                description: String!,
                price: Float!,
                date: String!,
                creator: User!
            }

            type User {
                _id: ID!
                email: String!
                password: String
                createdEvents: [Event!]
            }

            input UserInput {
                email: String!
                password: String!
            }

            input EventInput {
                _id: ID,
                name: String!,
                description: String!,
                price: Float!,
                date: String!
            }

            type RootQuery {
                events: [Event!]!
                users: [User!]!
            }

            type RootMutation {
                createEvent(eventInput: EventInput): Event
                createUser(userInput: UserInput): User
            }

            schema {
                query: RootQuery
                mutation: RootMutation
            }
    `),
        rootValue: {
            events: () => {
                return Event.find({})
                    .populate('creator')
                    .then(response => {
                        return response.map(event => {
                            return { ...event._doc }
                        });
                    })
                    .catch(((err) => {
                        throw err;
                    }));
            },
            users: () => {
                return User.find()
                    .then(response => {
                        return response.map(user => {
                            return { ...user._doc, password: null }
                        })
                    })
                    .catch((err) => {
                        throw err;
                    })
            },
            createEvent: args => {
                const event = new Event({
                    name: args.eventInput.name,
                    description: args.eventInput.description,
                    price: +args.eventInput.price,
                    date: new Date(args.eventInput.date),
                    creator: '5cb36c559b6e8c4c94d98bd2'
                })
                return event.save()
                    .then(response => {
                        createdEvent = { ...response._doc };
                        return User.findById('5cb36c559b6e8c4c94d98bd2')
                    })
                    .then(user => {
                        if (!user) {
                            throw new Error('User doesnt exist')
                        }
                        user.createdEvents.push(event);
                        return user.save();
                    })
                    .then(result => {
                        return createdEvent
                    })
                    .catch((err) => {
                        console.log(err);
                        throw err;
                    })
            },
            createUser: args => {
                return User.findOne({ email: args.userInput.email })
                    .then(user => {
                        if (user) {
                            throw new Error('User already exists!');
                        }
                        return bcrypt.hash(args.userInput.password, 12)
                    })
                    .then(hashedPassword => {
                        const user = new User({
                            email: args.userInput.email,
                            password: hashedPassword
                        })
                        return user.save()
                    })
                    .then(response => {
                        return { ...response._doc, password: null };
                    })
                    .catch((err) => {
                        throw err
                    })
            }
        },
        graphiql: true
    }))

mongoose
    .connect(
        `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@cluster0-f5eyi.mongodb.net/${process.env.MONGO_DB}?retryWrites=true`,
        { useNewUrlParser: true }
    )
    .then(() => {
        app.listen(3000);
    })
    .catch((err) => {
        console.log(err);
    })