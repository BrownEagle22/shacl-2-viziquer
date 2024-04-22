select * from dbpedia_shacl.classes
select * from dbpedia_shacl.properties
select * from dbpedia_shacl.cp_rels
select * from dbpedia_shacl.cpd_rels

select * from dbpedia_shacl.parameters
select * from empty.parameters

select * from dbpedia_shacl.ns
delete from dbpedia_shacl.cpd_rels;
delete from dbpedia_shacl.cp_rels;
delete from dbpedia_shacl.properties;
delete from dbpedia_shacl.classes;




--select * from dbpedia_shacl.ns




--insert into dbpedia_shacl.ns (name, value, priority, is_local, basic_order_level)
--select name, value, priority, is_local, basic_order_level from mini_university.ns

--insert into mini_university.ns (name, value, priority, is_local, basic_order_level)
--values ('ex', 'http://example.com/ns#AddressShape', 0, false, 0)



delete from mini_university.cpd_rels
where id > 64;

delete from mini_university.cp_rels
where id > 141;

delete from mini_university.properties
where id > 28;

delete from mini_university.classes
where id > 16;



select * from mini_university.classes
where id = 16;

select * from mini_university.properties
where local_name in ('studentName', 'personName')

select * from mini_university.cp_rels
where property_id in (17,18) and class_id = 16

-- !!!
select * from mini_university.cpd_rels
where cp_rel_id in (83,88)
select * from mini_university.cp_rel_types

select p1.local_name p1_name, p2.local_name p2_name, pp.* from mini_university.pp_rels pp
inner join mini_university.properties p1
on pp.property_1_id = p1.id
inner join mini_university.properties p2
on pp.property_2_id = p2.id
where property_1_id in (17,18) or
		property_2_id in (17,18)

--pp_rel_type; 2: common_subject

select * from mini_university.pp_rel_types;
select * from mini_university.datatypes


--Atlasa visu, kam nav virsklašu
select c.* from mini_university.classes c
left join mini_university.cc_rels cc
on c.id = class_1_id-- or c.id = class_2_id
where cc.id is null

--INFO about Student class
select * from mini_university.classes
where local_name = 'Student'

select * from mini_university.cc_rels
where class_1_id = 16 or class_2_id = 16

select * from mini_university.cc_rel_types

select * from mini_university.classes
where id = 14