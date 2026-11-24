package com.yutopia.support;

import javax.sql.DataSource;

import com.zaxxer.hikari.HikariDataSource;
import org.apache.ibatis.session.SqlSessionFactory;
import org.mybatis.spring.SqlSessionFactoryBean;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;

/** JUnit 5 native lifecycle avoids Spring 7's JUnit 6-only SpringExtension. */
@TestConfiguration(proxyBeanMethods = false)
@Profile("dao-test")
@MapperScan("com.yutopia.model.dao")
@Import(TestDatabaseSafetyConfiguration.class)
public class DaoTestConfiguration {
    @Bean
    DataSource dataSource(Environment environment) {
        var pool = new HikariDataSource();
        pool.setJdbcUrl(environment.getRequiredProperty("spring.datasource.url"));
        pool.setUsername(environment.getRequiredProperty("spring.datasource.username"));
        pool.setPassword(environment.getRequiredProperty("spring.datasource.password"));
        pool.setDriverClassName("com.mysql.cj.jdbc.Driver");
        pool.setMaximumPoolSize(3);
        pool.setMinimumIdle(0);
        pool.setConnectionTimeout(10000);
        return pool;
    }

    @Bean
    SqlSessionFactory sqlSessionFactory(DataSource dataSource, Environment environment) throws Exception {
        var bean = new SqlSessionFactoryBean();
        bean.setDataSource(dataSource);
        bean.setTypeAliasesPackage(environment.getRequiredProperty("mybatis.type-aliases-package"));
        bean.setMapperLocations(new PathMatchingResourcePatternResolver().getResources(
                environment.getRequiredProperty("mybatis.mapper-locations")));
        var configuration = new org.apache.ibatis.session.Configuration();
        configuration.setMapUnderscoreToCamelCase(environment.getProperty(
                "mybatis.configuration.map-underscore-to-camel-case", Boolean.class, true));
        bean.setConfiguration(configuration);
        return bean.getObject();
    }

    @Bean
    JdbcTemplate jdbcTemplate(DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }

    @Bean
    DataSourceTransactionManager transactionManager(DataSource dataSource) {
        return new DataSourceTransactionManager(dataSource);
    }
}
