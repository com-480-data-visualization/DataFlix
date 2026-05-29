# DataFlix : The Evolution of Cinema

Website: https://com-480-data-visualization.github.io/DataFlix/  
Repository: https://github.com/com-480-data-visualization/DataFlix
Process book: https://github.com/com-480-data-visualization/DataFlix/blob/master/milestone_3/process_book.pdf
Video : https://drive.google.com/file/d/1vpp4RunCiOQVyvkbWXCALmJUgyCj8drE/view

## What it is

DataFlix is a scrollable, single-page visualization that traces how cinema has changed from 1988 to 2025. The site is structured as a guided journey through the data : you scroll down and move through sections covering movie production, genre trends, ratings, and box office economics. Each section has interactive elements you can click on: genre filters, decade selectors, a play button that animates a chart across eras, and a slider at the end that lets you pick a year and see what cinema looked like at that moment.

The sections are:

- **Production** — number of films released per year, filterable by genre
- **Genres** — stacked area chart showing how genre share has shifted over time; click a genre to filter other charts
- **Quality** — average ratings over time, a genre-vs-rating heatmap, and a Sankey-style flow showing which genres land in which quality tiers
- **Economics** — budget vs revenue scatter broken down by genre and decade
- **Films** — landmark films from each era to put the data in context
- **Insights** — four key takeaways from the dataset
- **Your cinema era** — a personal slider linking your birth year to the films and stats of that moment

**Directory structure:**

```
docs/
  index.html        main page
  script.js         all visualization logic
  style.css         layout and theming
  assets/           images used in the page background and transitions
  data/             preprocessed JSON files consumed by the charts
milestone_1/        milestone 1 report and notebook
milestone_2/        milestone 2 report
milestone_3/        milestone 3 process book + readme

```

## Dataset

The underlying data comes from the TMDB Movies Daily Updates dataset on Kaggle, which aggregates metadata from The Movie Database. It covers around 1.1 million movies with 28 variables including release date, genre, budget, revenue, popularity score, and average rating. The raw CSV is not committed to the repository because of its size. The `docs/data/` folder contains the preprocessed JSON files that the charts actually read.
