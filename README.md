# Project of Data Visualization (COM-480)

| Student's name | SCIPER |
| -------------- | ------ |
| Lin Xiaoya | 423134 |
| Wu Yiqian | 423147 |
| Liu Tingsen | 422014 |

[Milestone 1](#milestone-1) • [Milestone 2](#milestone-2) • [Milestone 3](#milestone-3)

## Milestone 1 (21st March, 5pm)

**10% of the final grade**

This is a preliminary milestone to let you set up goals for your final project and assess the feasibility of your ideas.
Please, fill the following sections about your project.

*(max. 2000 characters per section)*

### Dataset

For our project, we combined three publicly available international datasets from the World Health Organization (WHO) and the World Bank. 

The sources of these data are reliable and authoritative. However, due to coming from different organizations/institutions, we need to do some data cleaning and integration (such as integrating two datasets by year and country to obtain a more correlated integrated dataset)


Datasets:
1. Life Expectancy at Birth (WHO):
https://www.who.int/data/gho/data/indicators/indicator-details/GHO/life-expectancy-at-birth-(years)
2. GDP per Capita (World Bank):
https://data.worldbank.org/indicator/NY.GDP.PCAP.CD
3. NCD Mortality Rate (World Bank):
https://data.worldbank.org/indicator/SH.DYN.NCOM.ZS

### Problematic

**Life expectancy** is one of the most widely used indicators of a country’s overall well-being. It reflects not only healthcare quality but also economic conditions, education, public policy, and social inequality. At the same time, economic development — often measured through GDP per capita — is commonly assumed to improve living standards and health outcomes. However, the strength and nature of this relationship is not always straightforward.

Our project aims to explore the following central questions:
- How strongly is GDP per capita associated with life expectancy across countries?
- What are the differences in life expectancy between men and women globally?
- How is GDP related to mortality from non-communicable diseases (NCDs), and does higher income necessarily imply lower NCD mortality?

By visualising these relationships, we aim to better understand the interplay between economic development and public health.

This project is relevant to students of economics, public health, and global development, as well as anyone interested in understanding global inequality. By presenting interactive visualisations and statistical summaries, we provide a clear and accessible overview of how wealth, gender, and disease burden relate to longevity.

### Exploratory Data Analysis

All three datasets were loaded into pandas DataFrames. Since they originate from different sources, preprocessing was necessary before merging:

- Year variables were converted to consistent integer formats.
- Country names were standardised to ensure correct joins.
- Rows missing essential values (GDP per capita, life expectancy, or NCD mortality rate) were removed.
- GDP per capita was log-transformed to better capture non-linear relationships and reduce skewness.

The datasets were then **merged using inner joins on country and year**, ensuring that only observations present in all three datasets were retained. The resulting dataset **spans from 2000 to 2021, with 12,060 total records**.

All these works can be found in the Jupyter Notebook [`EDA.ipynb`](./data-preprocessing/EDA.ipynb). 


Key findings:

1. On average across the dataset, women live 4.84 years longer than men.
2. GDP and Life Expectancy maintain a strong logarithmic correlation
3. Higher GDP tends to be associated with lower NCD mortality.
However, substantial variance remains even among high-income countries.


### Related work

While giants like Gapminder (gapminder.org/tools) and the IHME’s GBD Compare (vizhub.healthdata.org/gbd-compare/) offer comprehensive data on health and wealth, they function more like digital encyclopedias than narrative tools. For the casual user, uncovering how preventable middle-age mortality intersects with economic status requires tedious cross-referencing across multiple platforms. The data is "there," but it isn't always "alive."
Our project takes the high-quality data provided by the World Bank Open Data (data.worldbank.org/indicator/SH.DYN.NCOM.ZS) but aims to strip away the academic density. While these databases are excellent for finding individual indicators, they can be intimidating for those looking for a cohesive narrative. Our approach is original because we focus on the "Survival Filter": specifically linking the wealth of a nation (GDP) to the likelihood of a citizen surviving their "prime years" (ages 30 to 70) without falling victim to Non-Communicable Diseases (NCDs) like heart disease or cancer. This variable acts as the primary gatekeeper for overall longevity.

We use Life Expectancy at birth to measure the overall impact of NCDs, while using Life Expectancy at 60 as a validation metric. This comparison allows us to distinguish between nations that efficiently use GDP for prevention (reducing 30-70 mortality, thus raising At-birth expectancy) versus those that use it primarily for treatment (having high NCD mortality but long life expectancy for survivors at 60). Visually, we were inspired by the clean, interactive aesthetics of The Pudding (pudding.cool). By bringing GDP, NCD mortality, and gendered longevity into one animated interface, we transform complex public health statistics into an interactive journey.

(Note: The datasets utilized in this project have not been explored by our team in any previous ML, ADA, or semester projects).

## Milestone 2 (18th April, 5pm)

**10% of the final grade**


## Milestone 3 (30th May, 5pm)

**80% of the final grade**


## Late policy

- < 24h: 80% of the grade for the milestone
- < 48h: 70% of the grade for the milestone

