import { createClient } from "@supabase/supabase-js";
const { Client } = require('pg')
const fs = require('fs')
const { DateTime } = require('luxon')
import * as dotenv from "dotenv";

// Configure dotenv
dotenv.config();

// Create a supabase client
const supabase = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_KEY ?? ""
);

// Date is today's date
const targetDate = new Date().toISOString().split("T")[0];

// Get the row that has delivery_date equal to today and hub equal to TTF from table eex-daily-prices
const { data: dateRow, error: dateRowError } = await supabase
  .from("eex-daily-prices")
  .select("*")
  .eq("delivery_day", targetDate)
  .eq("hub", "TTF")
  .limit(1);

// Print the data
console.log(dateRow);

const supabaseUrl = process.env.DB_HOST ?? ""
const supabaseUser = process.env.DB_USER ?? ""
const supabasePassword = process.env.DB_PASS ?? ""
const supabaseDatabase = process.env.DB_NAME ?? ""

// Create a PostgresSQL client
const client = new Client({
    user: supabaseUser,
    host: supabaseUrl,
    database: supabaseDatabase,
    password: supabasePassword,
    port: 5432,
    ssl: {
        rejectUnauthorized: false,
        // ca: fs.readFileSync('prod-ca-2021.crt').toString()
    }
})

// Connect to the database
client.connect()

// A function that queries the database for the gas usage for a specific date
async function queryGasUsageByDate(targetDate) {
  return new Promise((resolve, reject) => {
    client.query(`SELECT * FROM usage_gas WHERE date_trunc('day', gas_timestamp AT TIME ZONE 'Europe/Amsterdam') = '${targetDate}'::date`, (err, res) => {
      if (err) {
        reject(err)
      }

      resolve(res.rows)
      client.end()
    })
  })
}

// Call the function and wait for the result
const rows = await queryGasUsageByDate(targetDate)

// Calcluate the total usage of gas for the day, by subtracting the last row from the first row
const totalUsage = rows[rows.length - 1].gas_value - rows[0].gas_value

// Get the price of gas for the day
const dayAheadPrice = dateRow[0].value / 100

// Constants for the price calculation
const energyTax = 0.48980
const handlingFee = 0.024793
const transportFee = 0.01652
const tax = 0.21

// Calculate the total price
const totalPricePerM3WithoutTax = dayAheadPrice + energyTax + handlingFee + transportFee
const totalPricePerM3 = totalPricePerM3WithoutTax * (1 + tax)

// Calculate the total cost
const totalCost = totalUsage * totalPricePerM3

console.log(`Total usage: ${totalUsage} m3`)
console.log(`Total price per m3: ${totalPricePerM3} EUR`)
console.log(`Total cost: ${totalCost} EUR`)