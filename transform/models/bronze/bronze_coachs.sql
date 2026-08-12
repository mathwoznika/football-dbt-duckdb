-- Historico de tecnicos. O grao e a PASSAGEM (tecnico x clube x periodo),
-- porque o array "career" traz a carreira inteira de cada treinador que
-- passou pelo clube consultado — inclusive os clubes anteriores dele.

with resposta as (

    select * from {{ source('raw', 'coachs') }}

),

tecnicos as (

    select
        _meta.params.team as team_id_consultado,
        _meta.extraido_em as extraido_em,
        unnest(response)  as item
    from resposta

),

passagens as (

    select
        item.id          as coach_id,
        item.name        as nome,
        item.firstname   as primeiro_nome,
        item.lastname    as sobrenome,
        item.nationality as nacionalidade,
        item.age         as idade,
        team_id_consultado,
        extraido_em,
        unnest(item.career) as passagem
    from tecnicos

)

select
    coach_id,
    nome,
    primeiro_nome,
    sobrenome,
    nacionalidade,
    idade,
    passagem.team.id                  as team_id,
    passagem.team.name                as team_nome,
    try_cast(passagem.start as date)  as inicio,
    try_cast(passagem."end" as date)  as fim,
    team_id_consultado,
    extraido_em
from passagens
