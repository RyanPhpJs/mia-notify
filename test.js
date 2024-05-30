const date = new Date("1/1/2000");
const url =
    "https://mia-notify-5f75dcb82462.herokuapp.com/api/recent/anime?after=" +
    ~~(date.getTime() / 1000);
const axios = require("axios");

axios.default
    .get(url, {
        headers: {
            Authorization: "Bearer GXAT4kNHC0sx5AUmifFh0cncoCg",
        },
    })
    .then((res) => {
        console.log(res);
    })
    .catch((err) => console.error(err));
